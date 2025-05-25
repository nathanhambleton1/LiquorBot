/*
 * ---------------------------------------------------------------------------
 *  Project : Liquor Bot
 *  File    : bluetooth_setup.cpp      (REPLACEMENT – 24 May 2025)
 *  Purpose : • Advertise a unique LiquorBot peripheral
 *            • Receive Wi-Fi creds (SSID/PW)
 *            • Expose WIFI_STATUS_CHAR_UUID  →  "0" (offline) / "1" (online)
 *            • When status flips to "1" the current central is disconnected,
 *              but advertising continues so other users can still hand-shake.
 * ---------------------------------------------------------------------------
 */
#include "bluetooth_setup.h"
#include "wifi_setup.h"          // setWiFiCredentials(), connectToWiFi()
#include <esp_mac.h>
#include <NimBLEDevice.h>

/* ---------------------- Private 128-bit UUIDs ----------------------------- */
static const NimBLEUUID SERVICE_UUID ("e0be0301-718e-4700-8f55-a24d6160db08");
static const NimBLEUUID SSID_UUID    ("e0be0302-718e-4700-8f55-a24d6160db08");
static const NimBLEUUID PASS_UUID    ("e0be0303-718e-4700-8f55-a24d6160db08");
static const NimBLEUUID STATUS_UUID  ("e0be0304-718e-4700-8f55-a24d6160db08");

/* ---------------------- Globals ------------------------------------------ */
static NimBLECharacteristic *ssidCharacteristic     = nullptr;
static NimBLECharacteristic *passwordCharacteristic = nullptr;
static NimBLECharacteristic *statusCharacteristic   = nullptr;
static NimBLEServer         *bleServer             = nullptr;
static uint16_t              currentConnId         = 0;  // populated onConnect

static bool credentialsReceived = false;

/* ---------------------- Server callbacks ---------------------------------- */
class ServerCB : public NimBLEServerCallbacks {
    void onConnect(NimBLEServer* /*srv*/, NimBLEConnInfo& info) override {
        currentConnId = info.getConnHandle();
    }

    // NEW: third parameter required since v2.x
    void onDisconnect(NimBLEServer* /*srv*/, NimBLEConnInfo& /*info*/, int /*reason*/) override {
        currentConnId = 0;
    }
};


/* ---------------------- Characteristic callback --------------------------- */
class CredCB : public NimBLECharacteristicCallbacks {
    void onWrite(NimBLECharacteristic* /*c*/, NimBLEConnInfo& /*info*/) override {
        const std::string ssidVal = ssidCharacteristic    ->getValue();
        const std::string passVal = passwordCharacteristic->getValue();
        if (!ssidVal.empty() && !passVal.empty()) {
            setWiFiCredentials(ssidVal, passVal);
            credentialsReceived = true;
            connectToWiFi();                    // non-blocking (returns quickly)
        }
    }
};

/* ---------------------- Public helpers ------------------------------------ */
bool areCredentialsReceived() { return credentialsReceived; }

/*  Called from wifi_setup.cpp once Wi-Fi + MQTT are up  */
void notifyWiFiReady() {
    if (statusCharacteristic) {
        statusCharacteristic->setValue("1");    // “online”
        statusCharacteristic->notify(false);    // no payload change → still ok
    }
    /* Kick current central (if any) so the app swaps to Wi-Fi */
    if (bleServer && currentConnId) {
        bleServer->disconnect(currentConnId);
        currentConnId = 0;
    }
}

/* ---------------------- Initialiser --------------------------------------- */
void setupBluetooth() {
    /* Unique, human-readable name → “LiquorBot-XXXX” (MAC tail) */
    uint8_t mac[6]; esp_read_mac(mac, ESP_MAC_WIFI_STA);
    char devName[18]; sprintf(devName, "LiquorBot-%02X%02X", mac[4], mac[5]);

    NimBLEDevice::init(devName);
    NimBLEDevice::setPower(ESP_PWR_LVL_P9);     // max TX for easy discovery

    bleServer = NimBLEDevice::createServer();
    static ServerCB serverCb; bleServer->setCallbacks(&serverCb);

    NimBLEService *svc = bleServer->createService(SERVICE_UUID);

    ssidCharacteristic     = svc->createCharacteristic(
                                SSID_UUID , NIMBLE_PROPERTY::WRITE);
    passwordCharacteristic = svc->createCharacteristic(
                                PASS_UUID , NIMBLE_PROPERTY::WRITE);
    statusCharacteristic   = svc->createCharacteristic(
                                STATUS_UUID, NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY);

    static CredCB credCb;
    ssidCharacteristic    ->setCallbacks(&credCb);
    passwordCharacteristic->setCallbacks(&credCb);

    statusCharacteristic  ->setValue("0");      // “offline” at boot

    svc->start();

    /* -------- Advertising packet ----------------------------------------- */
    NimBLEAdvertising* adv = NimBLEDevice::getAdvertising();

    NimBLEAdvertisementData advData;
    advData.addServiceUUID(SERVICE_UUID);       // flags auto-added
    adv->setAdvertisementData(advData);

    NimBLEAdvertisementData scanResp;
    scanResp.setName(devName);
    std::string mdata = "LQBT";
    mdata.push_back(static_cast<char>(mac[4]));
    mdata.push_back(static_cast<char>(mac[5]));
    scanResp.setManufacturerData(mdata);
    adv->setScanResponseData(scanResp);

    adv->start();
    Serial.printf("BLE advertising as %s (service %s)\n",
                  devName, SERVICE_UUID.toString().c_str());
}
