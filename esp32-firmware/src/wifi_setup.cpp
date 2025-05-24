/*
 * -----------------------------------------------------------------------------
 *  Project: Liquor Bot
 *  File: wifi_setup.cpp
 *  Description: Manages Wi-Fi connectivity by handling credential storage, 
 *               establishing a connection, and integrating with AWS IoT.
 * 
 *  Author: Nathan Hambleton
 * -----------------------------------------------------------------------------
 */

#include "wifi_setup.h"
#include <WiFi.h>
#include <NimBLEDevice.h>
#include "aws_manager.h"
#include "esp_wifi.h"

// Global variables to hold Wi-Fi credentials
std::string ssid = "";
std::string password = "";

// Function to set Wi-Fi credentials (called by BLE setup when credentials are received)
void setWiFiCredentials(const std::string &newSSID, const std::string &newPassword) {
    ssid = newSSID;
    password = newPassword;
}

// Function to connect to Wi-Fi using the received credentials
bool connectToWiFi() {
    // Ensure credentials are not empty
    if (ssid.empty() || password.empty()) {
        Serial.println("Wi-Fi credentials are empty. Cannot connect.");
        return false;
    }

    // Start Wi-Fi connection
    WiFi.begin(ssid.c_str(), password.c_str());

    Serial.print("Connecting to Wi-Fi");
    for (int i = 0; i < 10 && WiFi.status() != WL_CONNECTED; i++) {
        delay(1000);
        Serial.print(".");
    }

    // Check if connected
    if (WiFi.status() == WL_CONNECTED) {
        // Stop BLE advertising once connected
        NimBLEDevice::getAdvertising()->stop();
        NimBLEDevice::deinit(); // Deinitialize BLE
        Serial.println("\nConnected to Wi-Fi!");
        Serial.print("Device IP: ");
        Serial.println(WiFi.localIP());
        setupAWS();
        return true;
    } else {
        Serial.println("\nWi-Fi connection failed.");
        return false;
    }
}

/* -------------------------------------------------------------------------- */
/*            NEW – Disconnect and reboot into Bluetooth pairing              */
/* -------------------------------------------------------------------------- */
void disconnectFromWiFi() {
    Serial.println("Disconnecting from Wi-Fi and rebooting to BLE mode…");

    /* Tear down network & forget credentials stored in flash (STA-mode) */
    WiFi.disconnect(true, true);     // erase NVS & drop connection
    WiFi.mode(WIFI_OFF);
    esp_wifi_stop();

    delay(500);
    ESP.restart();                   // Startup will call setupBluetoothWiFiAWS()
}