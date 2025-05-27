/*
 * ---------------------------------------------------------------------------
 *  Project : Liquor Bot
 *  File    : bluetooth_setup.cpp      (REPLACEMENT – 25 May 2025)
 *  Purpose : • Advertise a LiquorBot peripheral whose name embeds LIQUORBOT_ID
 *            • Receive Wi-Fi creds (SSID / password)
 *            • Expose WIFI_STATUS_CHAR_UUID  →  "0" (offline) / "1" (online)
 *            • After Wi-Fi is ready, disconnect the central so the app
 *              switches to MQTT over Wi-Fi while advertising continues.
 * ---------------------------------------------------------------------------
 */
#include "bluetooth_setup.h"
#include "wifi_setup.h"          // setWiFiCredentials(), connectToWiFi()
#include "aws_manager.h"         // ← pulls in LIQUORBOT_ID
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
static NimBLEServer         *bleServer              = nullptr;
static uint16_t              currentConnId          = 0;   // populated onConnect

static bool credentialsReceived = false;

/* ---------------------- Server callbacks ---------------------------------- */
class ServerCB : public NimBLEServerCallbacks {
    void onConnect(NimBLEServer* /*srv*/, NimBLEConnInfo& info) override {
        currentConnId = info.getConnHandle();
    }
    void onDisconnect(NimBLEServer* /*srv*/, NimBLEConnInfo& /*info*/, int /*reason*/) override {
        currentConnId = 0;
    }
};

/* ---------------------- Characteristic callback --------------------------- */
class CredCB : public NimBLECharacteristicCallbacks {
    void onWrite(NimBLECharacteristic* /*c*/, NimBLEConnInfo& /*info*/) override {
        const auto& ssidVal = ssidCharacteristic->getValue();
        const auto& passVal = passwordCharacteristic->getValue();
        if (ssidVal.length() > 0 && passVal.length() > 0) {
            // Copy to heap-allocated strings if needed
            setWiFiCredentials(ssidVal, passVal);
            credentialsReceived = true;
            connectToWiFi();
        }
    }
};

/* ---------------------- Public helpers ------------------------------------ */
bool areCredentialsReceived() { return credentialsReceived; }

/*  Called from wifi_setup.cpp once Wi-Fi + MQTT are up  */
void notifyWiFiReady() {
    if (statusCharacteristic) {
        statusCharacteristic->setValue("1");   // tell central “Wi-Fi OK”
        statusCharacteristic->notify(false);
        delay(50);                             // ← NEW: give stack 40-50 ms
    }
    if (bleServer && currentConnId != 0) {
        bleServer->disconnect(currentConnId);  // kick the app off BLE
        currentConnId = 0;
    }
}

/* ---------------------- Initialiser --------------------------------------- */
void setupBluetooth() {
    /* Human-readable, fixed identifier —> “LiquorBot-<ID>”                */
    /* Max BLE name length is 29 bytes; our format is safe (<= 15)         */
    constexpr char prefix[] = "LiquorBot-";
    char devName[sizeof(prefix) + sizeof(LIQUORBOT_ID)];  // +1 handled by sizeof
    sprintf(devName, "%s%s", prefix, LIQUORBOT_ID);       // e.g. LiquorBot-007

    NimBLEDevice::init(devName);
    NimBLEDevice::setPower(ESP_PWR_LVL_P9);     // strongest TX for discovery

    bleServer = NimBLEDevice::createServer();
    static ServerCB serverCb; bleServer->setCallbacks(&serverCb);

    NimBLEService *svc = bleServer->createService(SERVICE_UUID);

    ssidCharacteristic     = svc->createCharacteristic(SSID_UUID , NIMBLE_PROPERTY::WRITE);
    passwordCharacteristic = svc->createCharacteristic(PASS_UUID , NIMBLE_PROPERTY::WRITE);
    statusCharacteristic   = svc->createCharacteristic(STATUS_UUID,
                                                       NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY);

    static CredCB credCb;
    ssidCharacteristic    ->setCallbacks(&credCb);
    passwordCharacteristic->setCallbacks(&credCb);

    statusCharacteristic  ->setValue("0");      // “offline” at boot
    svc->start();

    /* ---------------- Advertising packet -------------------------------- */
    NimBLEAdvertising* adv = NimBLEDevice::getAdvertising();

    /* → ADV payload */
    NimBLEAdvertisementData advData;
    advData.addServiceUUID(SERVICE_UUID);      // flags auto-added
    adv->setAdvertisementData(advData);

    /* → Scan-response payload */
    NimBLEAdvertisementData scanResp;
    scanResp.setName(devName);
    std::string mdata = "LQBT";                // 4-byte marker
    mdata.append(LIQUORBOT_ID);                // append ASCII ID, e.g. "007"
    scanResp.setManufacturerData(mdata);
    adv->setScanResponseData(scanResp);

    adv->start();
    Serial.printf("BLE advertising as %s (service %s)\n",
                  devName, SERVICE_UUID.toString().c_str());
}
