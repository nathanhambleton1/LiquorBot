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

/* ───────── Simple RAM storage ───────── */
static std::string ssid, pw;

void setWiFiCredentials(const std::string &s, const std::string &p) {
    ssid = s; pw = p;
}

bool connectToWiFi() {
    if (ssid.empty() || pw.empty()) return false;

    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid.c_str(), pw.c_str());
    Serial.print("Connecting to Wi-Fi");

    for (int i = 0; i < 20 && WiFi.status() != WL_CONNECTED; ++i) {
        delay(500); Serial.print(".");
    }
    Serial.println();

    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("✔ Wi-Fi OK – IP %s\n", WiFi.localIP().toString().c_str());
        setupAWS();              // init MQTT
        notifyWiFiReady();       // tell BLE side
        return true;
    }
    Serial.println("✖ Wi-Fi failed – will retry.");
    return false;
}

void disconnectFromWiFi() {
    Serial.println("⚠  Wi-Fi disconnect requested");
    WiFi.disconnect(true, true);
    WiFi.mode(WIFI_OFF);
    esp_wifi_stop();
    delay(300);
    ESP.restart();
}
