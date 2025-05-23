/*
 * -----------------------------------------------------------------------------
 *  Project: Liquor Bot
 *  File   : bluetooth_setup.cpp         (REPLACEMENT – 23 May 2025)
 *  Purpose: Advertise a unique LiquorBot BLE peripheral, receive Wi-Fi creds,
 *           then hand off to Wi-Fi / AWS.
 * -----------------------------------------------------------------------------
 */
#include "bluetooth_setup.h"
#include "wifi_setup.h"          // setWiFiCredentials(), connectToWiFi()
#include <esp_mac.h>
#include <NimBLEDevice.h>

// ----------- Private UUIDs ----------------------------------------------------
static const NimBLEUUID SERVICE_UUID ("e0be0301-718e-4700-8f55-a24d6160db08");
static const NimBLEUUID SSID_UUID    ("e0be0302-718e-4700-8f55-a24d6160db08");
static const NimBLEUUID PASS_UUID    ("e0be0303-718e-4700-8f55-a24d6160db08");

// ----------- Globals ----------------------------------------------------------
static NimBLECharacteristic *ssidCharacteristic     = nullptr;
static NimBLECharacteristic *passwordCharacteristic = nullptr;
static bool credentialsReceived = false;

// ----------- Characteristic callback -----------------------------------------
class CredCallback : public NimBLECharacteristicCallbacks {
    void onWrite(NimBLECharacteristic *c, NimBLEConnInfo& /*info*/) override {
        const std::string ssidVal = ssidCharacteristic    ->getValue();
        const std::string passVal = passwordCharacteristic->getValue();
        if (!ssidVal.empty() && !passVal.empty()) {
            setWiFiCredentials(ssidVal, passVal);
            credentialsReceived = true;
            connectToWiFi();
        }
    }
};

// ----------- Public helpers ---------------------------------------------------
bool areCredentialsReceived() { return credentialsReceived; }

// ----------- Initialiser ------------------------------------------------------
void setupBluetoothWiFiAWS() {
    // Use MAC tail to give every board a unique, human-readable name
    uint8_t mac[6];
    esp_read_mac(mac, ESP_MAC_WIFI_STA);
    char devName[18];                          // "LiquorBot-XXXX\0"
    sprintf(devName, "LiquorBot-%02X%02X", mac[4], mac[5]);

    NimBLEDevice::init(devName);
    NimBLEDevice::setPower(ESP_PWR_LVL_P9);    // full power for easier discovery

    // --- GATT server, service & characteristics ------------------------------
    NimBLEServer  *server = NimBLEDevice::createServer();
    NimBLEService *svc    = server->createService(SERVICE_UUID);

    ssidCharacteristic     = svc->createCharacteristic(SSID_UUID , NIMBLE_PROPERTY::WRITE);
    passwordCharacteristic = svc->createCharacteristic(PASS_UUID , NIMBLE_PROPERTY::WRITE);

    static CredCallback cb;
    ssidCharacteristic    ->setCallbacks(&cb);
    passwordCharacteristic->setCallbacks(&cb);

    svc->start();

    // --- Advertising ---------------------------------------------------------
    NimBLEAdvertising *adv = NimBLEDevice::getAdvertising();
    adv->addServiceUUID(SERVICE_UUID);
    adv->enableScanResponse(true);                    // ← renamed
    std::string mdata = "LQBT";
    mdata.push_back(static_cast<char>(mac[4]));
    mdata.push_back(static_cast<char>(mac[5]));
    adv->setManufacturerData(mdata);                  // ← renamed
    adv->setPreferredParams(0x06, 0x12);              // ← consolidated
    adv->start();
    Serial.printf("BLE advertising as %s – service %s\n",devName, SERVICE_UUID.toString().c_str());
}
