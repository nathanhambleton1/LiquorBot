/*
 * -----------------------------------------------------------------------------
 *  Project: Liquor Bot
 *  File: bluetooth_setup.cpp
 *  Description: Manages Bluetooth Low Energy (BLE) functionality for receiving 
 *               Wi-Fi credentials and initializing wireless connectivity.
 *               This module handles BLE communication, stores received SSID 
 *               and password, and attempts to connect to Wi-Fi.
 * 
 *  Author: Nathan Hambleton
 * -----------------------------------------------------------------------------
 */

#include "bluetooth_setup.h"
#include "wifi_setup.h"
#include <NimBLEDevice.h>

// Global variables
NimBLEServer *bleServer = nullptr;
NimBLECharacteristic *ssidCharacteristic = nullptr;
NimBLECharacteristic *passwordCharacteristic = nullptr;
std::string receivedSSID = ""; // Temporary storage for SSID
std::string receivedPassword = ""; // Temporary storage for password
bool credentialsReceived = false;

// Custom callback for BLE write events
class WiFiCredentialsCallback : public NimBLECharacteristicCallbacks {
    void onWrite(NimBLECharacteristic *characteristic, NimBLEConnInfo &connInfo) override {
        std::string value = characteristic->getValue();

        if (characteristic == ssidCharacteristic) {
            receivedSSID = value;
            Serial.print("Received SSID: ");
            Serial.println(receivedSSID.c_str());
        } else if (characteristic == passwordCharacteristic) {
            receivedPassword = value;
            Serial.print("Received Password: ");
            Serial.println(receivedPassword.c_str());
        }

        // If both SSID and password are received, set them and connect to Wi-Fi
        if (!receivedSSID.empty() && !receivedPassword.empty()) {
            setWiFiCredentials(receivedSSID, receivedPassword);
            credentialsReceived = true;
            Serial.println("Wi-Fi credentials received.");
            // Connect to Wi-Fi
            if (!connectToWiFi()) {
                ssidCharacteristic = nullptr;
                passwordCharacteristic = nullptr;
                credentialsReceived = false;
                Serial.println("Credentials reset. Try again.");
            }
        }
    }
};

void setupBluetoothWiFiAWS() {
    NimBLEDevice::init("LiquorBot");

    // Get the BLE MAC address and print it
    Serial.print("BLE Device Address: ");
    Serial.println(NimBLEDevice::getAddress().toString().c_str());
    
    bleServer = NimBLEDevice::createServer();

    // Create BLE service
    NimBLEService *wifiService = bleServer->createService("1fb68313-bd17-4fd8-b615-554ddfd462d6");

    // Create SSID characteristic
    ssidCharacteristic = wifiService->createCharacteristic(
        "20168ad5-9429-489e-b2b2-dc1902398f44",
        NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::READ
    );
    ssidCharacteristic->setCallbacks(new WiFiCredentialsCallback());

    // Create Password characteristic
    passwordCharacteristic = wifiService->createCharacteristic(
        "3f1d29eb-c1b6-44a5-a99e-dd147761dee7",
        NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::READ
    );
    passwordCharacteristic->setCallbacks(new WiFiCredentialsCallback());

    // Start the BLE service
    wifiService->start();

    // Start BLE advertising
    NimBLEAdvertising *advertising = NimBLEDevice::getAdvertising();
    advertising->addServiceUUID(wifiService->getUUID());
    advertising->start();

    Serial.println("BLE Advertising started. Waiting for Wi-Fi credentials...");
}

bool areCredentialsReceived() {
    return credentialsReceived;
}
