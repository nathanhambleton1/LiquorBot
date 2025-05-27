/*
 * ---------------------------------------------------------------------------
 *  Project : Liquor Bot
 *  File    : wifi_setup.cpp          (REPLACEMENT – 24 May 2025)
 *  Purpose : • Handle credential storage + Wi-Fi connect / disconnect
 *            • Notify BLE layer when the device is online
 * ---------------------------------------------------------------------------
 */
#include "wifi_setup.h"
#include <WiFi.h>
#include "bluetooth_setup.h"
#include "aws_manager.h"
#include "esp_wifi.h"

/* ------- Credential storage -------------------------------------------------
 * Simple RAM copy is fine for now (NVS persistence can be added later).
 */
std::string ssid     = "";
std::string password = "";

/* ---------------------------------------------------------------------------*/
void setWiFiCredentials(const std::string &newSSID,
                        const std::string &newPassword)
{
    ssid     = newSSID;
    password = newPassword;
}

/* ---------------------------------------------------------------------------*/
bool connectToWiFi() {
    if (ssid.empty() || password.empty()) {
        Serial.println("❗ Wi-Fi credentials empty – waiting…");
        return false;
    }

    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid.c_str(), password.c_str());
    Serial.print("Connecting to Wi-Fi");

    for (int i = 0; i < 20 && WiFi.status() != WL_CONNECTED; ++i) {
        delay(500);
        Serial.print(".");
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("\n✔ Wi-Fi connected – IP %s\n", WiFi.localIP().toString().c_str());

        /* Start MQTT immediately (non-blocking loop in main) */
        setupAWS();

        /* Tell BLE side that we’re online → char = "1", disconnect central   */
        return true;
    }

    Serial.println("\n✖ Wi-Fi connection failed.");
    return false;
}

/* ---------------- Danger-zone helper -------------------------------------- */
void disconnectFromWiFi() {
    Serial.println("⚠  Disconnecting from Wi-Fi → reboot to BLE-only mode");

    WiFi.disconnect(true, true);   // drop + erase
    WiFi.mode(WIFI_OFF);
    esp_wifi_stop();

    delay(300);
    ESP.restart();
}
