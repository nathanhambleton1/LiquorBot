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
