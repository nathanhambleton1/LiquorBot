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

    // Set state to SETUP at the very start
    setState(State::SETUP);

    initWiFiStorage();      // load saved creds from NVS
    setupBluetooth();       // always advertising

    if (!attemptSavedWiFiConnection()) {
        Serial.println("No saved WiFi credentials. Waiting for BLE...");
    }
    
    initDrinkController();
    initLED();

    // Setup complete, set state to IDLE
    setState(State::IDLE);

    /* Developers may override creds during bench-test --------------------- */
    //setWiFiCredentials("WhiteSky-TheWilde", "qg3v2zyr");
    //setWiFiCredentials("USuites_legacy", "onmyhonor");
    //connectToWiFi();
    /* --------------------------------------------------------------------- */
}

/* ------------------------------------------------------------------------- */
void loop() {
    // Only allow WiFi/MQTT/heartbeat if not in ERROR or SETUP
    State state = getCurrentState();
    if (state == State::ERROR || state == State::SETUP) {
        // In error or setup, do not process normal operations
        delay(100);
        return;
    }

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

    /* 3 · Heartbeat  ➜  always advertise liveness while Wi-Fi is up */
    if (millis() - lastHeartbeat >= HB_PERIOD) {
        if (WiFi.status() == WL_CONNECTED) sendHeartbeat();
        lastHeartbeat = millis();
    }
}