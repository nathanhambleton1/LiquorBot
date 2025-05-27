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
static unsigned long lastHeartbeatTime   = 0;
static constexpr unsigned long HB_PERIOD = 5000;   // ms

/* ------------------------------------------------------------------------- */
void setup() {
    Serial.begin(115200);
    Serial.println("\n=== LiquorBot boot ===");

    initializeState();      // IDLE

    setupBluetooth();       // always advertising

    /* Developers may override creds during bench-test --------------------- */
    //setWiFiCredentials("WhiteSky-TheWilde", "qg3v2zyr");
    //setWiFiCredentials("USuites_legacy", "onmyhonor");
    //connectToWiFi();
    /* --------------------------------------------------------------------- */

    initDrinkController();
    initLED();
}

/* ------------------------------------------------------------------------- */
void loop() {
    /* MQTT (non-blocking) */
    if (WiFi.status() == WL_CONNECTED) processAWSMessages();

    /* Heartbeat every HB_PERIOD */
    const unsigned long now = millis();
    if (now - lastHeartbeatTime >= HB_PERIOD) {
        sendHeartbeat();
        lastHeartbeatTime = now;
    }

}