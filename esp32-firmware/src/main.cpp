/*
 * ---------------------------------------------------------------------------
 *  Project : Liquor Bot
 *  File    : main.cpp                 (REPLACEMENT – 24 May 2025)
 *  Purpose : Initialise peripherals, keep BLE advertising permanently,
 *            and kick off Wi-Fi / MQTT when creds arrive.
 * ---------------------------------------------------------------------------
 */
#include <Arduino.h>
#include <HardwareSerial.h>
#include <NimBLEDevice.h>
#include "bluetooth_setup.h"
#include "wifi_setup.h"
#include "aws_manager.h"
#include "drink_controller.h"
#include "led_control.h"
#include "state_manager.h"

/* ---------------- Runtime constants -------------------------------------- */
static unsigned long lastHeartbeat = 0;
static constexpr unsigned long HB_PERIOD = 5000;      // ms
static unsigned long lastWiFiRetry = 0;
static constexpr unsigned long WIFI_RETRY_PERIOD = 10000; // ms

/* ------------------------------------------------------------------------- */
void setup() {
    Serial.begin(115200);
    Serial.println("\n=== LiquorBot boot ===");

    initializeState();      // IDLE
    initWiFiStorage();      // load saved creds from NVS
    setupBluetooth();       // always advertising

    if (!attemptSavedWiFiConnection()) {
        Serial.println("No saved WiFi credentials. Waiting for BLE...");
    }
    
    initDrinkController();
    initLED();

    /* Developers may override creds during bench-test --------------------- */
    //setWiFiCredentials("WhiteSky-TheWilde", "qg3v2zyr");
    //setWiFiCredentials("USuites_legacy", "onmyhonor");
    //connectToWiFi();
    /* --------------------------------------------------------------------- */
}

/* ------------------------------------------------------------------------- */
void loop() {
    /* 1 · Always try WiFi if disconnected */
    if (WiFi.status() != WL_CONNECTED) {
        static unsigned long lastRetry = 0;
        if (millis() - lastRetry >= WIFI_RETRY_PERIOD) {
            lastRetry = millis();
            connectToWiFi();  // Will use saved credentials
        }
    }

    /* 2 · Handle MQTT */
    if (WiFi.status() == WL_CONNECTED) {
        processAWSMessages();
    }

    /* 3 · Heartbeat */
    if (millis() - lastHeartbeat >= HB_PERIOD) {
        if (WiFi.status() == WL_CONNECTED) sendHeartbeat();
        lastHeartbeat = millis();
    }
}