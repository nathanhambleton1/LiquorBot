/*
 * ---------------------------------------------------------------------------
 *  Project : Liquor Bot
 *  File    : bluetooth_setup.cpp        (REPLACEMENT – 27 May 2025)
 * ---------------------------------------------------------------------------
 *  • Advertises “LiquorBot-<ID>”
 *  • Receives SSID / PW, triggers Wi-Fi connect
 *  • status char = "0" startup → "1" after Wi-Fi + MQTT
 *  • Kicks central, restarts advertising, leaves BLE on for others
 * ---------------------------------------------------------------------------
 */
#include "bluetooth_setup.h"
#include "wifi_setup.h"
#include "aws_manager.h"
#include <NimBLEDevice.h>

/* ───────── 128-bit UUIDs ───────── */
static const NimBLEUUID SERVICE_UUID("e0be0301-718e-4700-8f55-a24d6160db08");
static const NimBLEUUID SSID_UUID   ("e0be0302-718e-4700-8f55-a24d6160db08");
static const NimBLEUUID PASS_UUID   ("e0be0303-718e-4700-8f55-a24d6160db08");
static const NimBLEUUID STAT_UUID   ("e0be0304-718e-4700-8f55-a24d6160db08");

/* ───────── Globals ───────── */
static NimBLECharacteristic *ssidChar  = nullptr;
static NimBLECharacteristic *passChar  = nullptr;
static NimBLECharacteristic *statChar  = nullptr;
static NimBLEServer         *bleSrv    = nullptr;
static NimBLEAdvertising    *adv       = nullptr;
static uint16_t              connId    = 0;
static bool                  credsOK   = false;

/* ───────── Helper ───────── */
bool areCredentialsReceived() { return credsOK; }

/* ───────── Callbacks ─────── */
class SrvCB : public NimBLEServerCallbacks {
    void onConnect(NimBLEServer*, NimBLEConnInfo &info) override {
        connId = info.getConnHandle();
    }
    void onDisconnect(NimBLEServer*, NimBLEConnInfo&, int) override {
        connId = 0;
        if (adv) adv->start();                // keep advertising forever
    }
};

class CredCB : public NimBLECharacteristicCallbacks {
    void onWrite(NimBLECharacteristic*, NimBLEConnInfo&) override {
        const std::string &s = ssidChar->getValue();
        const std::string &p = passChar->getValue();
        if (!s.empty() && !p.empty()) {
            setWiFiCredentials(s, p);
            credsOK = true;
            connectToWiFi();                  // first attempt immediately
        }
    }
};

/* ───────── Public – notify app that Wi-Fi + MQTT are ready ───────── */
void notifyWiFiReady() {
    if (statChar) {
        statChar->setValue("1");
        statChar->notify();                   // let central read/notify
        delay(40);
    }
    if (bleSrv && connId) {
        bleSrv->disconnect(connId);           // kick to push app onto MQTT
        connId = 0;
    }
}

/* ───────── Initialiser ───────── */
void setupBluetooth() {
    char devName[24];
    snprintf(devName, sizeof(devName), "LiquorBot-%s", LIQUORBOT_ID);

    NimBLEDevice::init(devName);
    NimBLEDevice::setPower(ESP_PWR_LVL_P9);

    bleSrv = NimBLEDevice::createServer();
    static SrvCB cb; bleSrv->setCallbacks(&cb);

    NimBLEService *svc = bleSrv->createService(SERVICE_UUID);
    ssidChar = svc->createCharacteristic(SSID_UUID , NIMBLE_PROPERTY::WRITE);
    passChar = svc->createCharacteristic(PASS_UUID , NIMBLE_PROPERTY::WRITE);
    statChar = svc->createCharacteristic(STAT_UUID ,
                                         NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY);
    static CredCB credCB;
    ssidChar->setCallbacks(&credCB);
    passChar->setCallbacks(&credCB);
    statChar->setValue("0");                 // offline at boot
    svc->start();

    adv = NimBLEDevice::getAdvertising();
    NimBLEAdvertisementData advData;  advData.addServiceUUID(SERVICE_UUID);
    adv->setAdvertisementData(advData);

    NimBLEAdvertisementData scanResp; scanResp.setName(devName);
    std::string mfg = "LQBT"; mfg.append(LIQUORBOT_ID);  // marker + ID
    scanResp.setManufacturerData(mfg);
    adv->setScanResponseData(scanResp);

    adv->start();
    Serial.printf("BLE advertising as %s\n", devName);
}
