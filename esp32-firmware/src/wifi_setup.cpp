/*
 * ---------------------------------------------------------------------------
 *  Project : Liquor Bot
 *  File    : wifi_setup.cpp             (REPLACEMENT – 27 May 2025)
 * ---------------------------------------------------------------------------
 *  • Store creds in RAM (NVS later)
 *  • Connect STA, then start MQTT + notify BLE
 *  • Disconnect helper reboots into BLE-only mode
 * ---------------------------------------------------------------------------
 */
#include "wifi_setup.h"
#include <WiFi.h>
#include "aws_manager.h"
#include "bluetooth_setup.h"
#include "esp_wifi.h"
#include <Preferences.h>  // Add for NVS

static Preferences prefs;  // Add NVS preferences

std::string ssid, pw;

// Add init function for NVS
void initWiFiStorage() {
    prefs.begin("wifi-creds", false);
    ssid = prefs.getString("ssid", "").c_str();
    pw = prefs.getString("pass", "").c_str();
    prefs.end();
}

void setWiFiCredentials(const std::string &s, const std::string &p) {
    ssid = s;
    pw = p;
    
    // Save to NVS
    prefs.begin("wifi-creds", false);
    prefs.putString("ssid", s.c_str());
    prefs.putString("pass", p.c_str());
    prefs.end();
}

void clearWiFiCredentials() {
    prefs.begin("wifi-creds", false);
    prefs.remove("ssid");
    prefs.remove("pass");
    prefs.end();
    ssid = "";
    pw = "";
}

bool connectToWiFi() {
    if (ssid.empty() || pw.empty()) {
        Serial.println("No WiFi credentials available");
        return false;
    }

    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid.c_str(), pw.c_str());
    Serial.print("Connecting to ");
    Serial.print(ssid.c_str());

    unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start < 10000) {
        delay(500);
        Serial.print(".");
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("\n✔ WiFi Connected! IP: %s\n", WiFi.localIP().toString().c_str());
        setupAWS();
        notifyWiFiReady();
        return true;
    }
    
    Serial.println("\n✖ Connection failed");
    return false;
}

void disconnectFromWiFi() {
    Serial.println("⚠  Wi-Fi disconnect requested - CLEARING CREDENTIALS");
    
    // NEW: Clear credentials before restarting
    clearWiFiCredentials();
    
    // Disconnect and restart
    WiFi.disconnect(true, true);
    WiFi.mode(WIFI_OFF);
    esp_wifi_stop();
    delay(300);
    ESP.restart();
}

bool attemptSavedWiFiConnection() {
    return !ssid.empty() && !pw.empty() && connectToWiFi();
}
