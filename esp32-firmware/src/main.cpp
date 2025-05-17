/*
 * -----------------------------------------------------------------------------
 *  Project: Liquor Bot
 *  File: main.cpp
 *  Description: This program initializes and manages Wi-Fi, Bluetooth, and AWS 
 *               connectivity for the cocktail-making robot. It ensures a stable 
 *               connection to AWS for processing commands and controlling the 
 *               drink dispenser.
 * 
 *  Author: Nathan Hambleton
 * -----------------------------------------------------------------------------
 */

#include <Arduino.h>
#include <HardwareSerial.h>
#include <NimBLEDevice.h>
#include "wifi_setup.h"
#include "bluetooth_setup.h"
#include "aws_manager.h"
#include "drink_controller.h"
#include "led_control.h"
#include "state_manager.h"


void setup() {
    Serial.begin(115200);
    Serial.println("Initializing Serial COM...");

    initializeState();   // IDLE by default

    // Initialize BLE and Wi-Fi setup
    //setupBluetoothWiFiAWS();

    setWiFiCredentials("WhiteSky-TheWilde", "qg3v2zyr");
    //setWiFiCredentials("USuites_legacy", "onmyhonor");
    connectToWiFi();
    setupAWS();
    initDrinkController();
    initLED();
}

unsigned long lastHeartbeatTime = 0; // Track the last heartbeat time
const unsigned long heartbeatInterval = 5000; // 10 seconds

void loop() {
    if (WiFi.status() == WL_CONNECTED) {
        processAWSMessages();
    }

    // Send heartbeat message every 10 seconds
    unsigned long currentTime = millis();
    if (currentTime - lastHeartbeatTime >= heartbeatInterval) {
        sendHeartbeat();
        lastHeartbeatTime = currentTime;
    }
}
