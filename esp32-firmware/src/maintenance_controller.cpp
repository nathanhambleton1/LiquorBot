/*  maintenance_controller.cpp
 *  Handles system maintenance actions (priming, cleaning, emptying, etc.)
 *  Integrates with state_manager and aws_manager for robust state and cloud communication.
 *  Author: Nathan Hambleton – 2025
 * -------------------------------------------------------------------------- */

#include <Arduino.h>
#include "maintenance_controller.h"
#include "state_manager.h"
#include "aws_manager.h"
#include "led_control.h"

// --- FreeRTOS task forward declarations ---
static void readySystemTask(void *param);
static void emptySystemTask(void *param);
static void deepCleanTask(void *param);

// Example: Ready system (prime tubes)
void startReadySystemTask() {
    if (getCurrentState() != State::IDLE) {
        Serial.println("✖ Cannot start READY_SYSTEM: System not IDLE");
        sendData(MAINTENANCE_TOPIC, "{\"status\":\"fail\",\"error\":\"busy\"}");
        return;
    }
    // Start FreeRTOS task for non-blocking maintenance
    if (xTaskCreate(readySystemTask, "readySystemTask", 4096, nullptr, 1, nullptr) != pdPASS) {
        Serial.println("❌ Failed to create READY_SYSTEM task");
        sendData(MAINTENANCE_TOPIC, "{\"status\":\"fail\",\"error\":\"task_fail\"}");
    }
}

void startEmptySystemTask() {
    if (getCurrentState() != State::IDLE) {
        Serial.println("✖ Cannot start EMPTY_SYSTEM: System not IDLE");
        sendData(MAINTENANCE_TOPIC, "{\"status\":\"fail\",\"error\":\"busy\"}");
        return;
    }
    if (xTaskCreate(emptySystemTask, "emptySystemTask", 4096, nullptr, 1, nullptr) != pdPASS) {
        Serial.println("❌ Failed to create EMPTY_SYSTEM task");
        sendData(MAINTENANCE_TOPIC, "{\"status\":\"fail\",\"error\":\"task_fail\"}");
    }
}

void startDeepCleanTask() {
    if (getCurrentState() != State::IDLE) {
        Serial.println("✖ Cannot start DEEP_CLEAN: System not IDLE");
        sendData(MAINTENANCE_TOPIC, "{\"status\":\"fail\",\"error\":\"busy\"}");
        return;
    }
    if (xTaskCreate(deepCleanTask, "deepCleanTask", 4096, nullptr, 1, nullptr) != pdPASS) {
        Serial.println("❌ Failed to create DEEP_CLEAN task");
        sendData(MAINTENANCE_TOPIC, "{\"status\":\"fail\",\"error\":\"task_fail\"}");
    }
}

// --- FreeRTOS task implementations ---
static void readySystemTask(void *param) {
    setState(State::MAINTENANCE);
    ledPouring();
    Serial.println("→ State set to MAINTENANCE (READY_SYSTEM)");
    // Simulate work for 10 seconds, but yield frequently for heartbeats/messages
    const unsigned long totalMs = 10000;
    const unsigned long stepMs = 50;
    unsigned long waited = 0;
    while (waited < totalMs) {
        vTaskDelay(pdMS_TO_TICKS(stepMs));
        waited += stepMs;
        // Optionally, check for abort/error here
    }
    setState(State::IDLE);
    ledIdle();
    sendData(MAINTENANCE_TOPIC, "{\"status\":\"ok\",\"action\":\"READY_SYSTEM\"}");
    Serial.println("→ State set to IDLE after READY_SYSTEM");
    vTaskDelete(nullptr);
}

static void emptySystemTask(void *param) {
    setState(State::MAINTENANCE);
    ledPouring();
    Serial.println("→ State set to MAINTENANCE (EMPTY_SYSTEM)");
    const unsigned long totalMs = 10000;
    const unsigned long stepMs = 50;
    unsigned long waited = 0;
    while (waited < totalMs) {
        vTaskDelay(pdMS_TO_TICKS(stepMs));
        waited += stepMs;
    }
    setState(State::IDLE);
    ledIdle();
    sendData(MAINTENANCE_TOPIC, "{\"status\":\"ok\",\"action\":\"EMPTY_SYSTEM\"}");
    Serial.println("→ State set to IDLE after EMPTY_SYSTEM");
    vTaskDelete(nullptr);
}

static void deepCleanTask(void *param) {
    setState(State::MAINTENANCE);
    ledPouring();
    Serial.println("→ State set to MAINTENANCE (DEEP_CLEAN)");
    const unsigned long totalMs = 10000;
    const unsigned long stepMs = 50;
    unsigned long waited = 0;
    while (waited < totalMs) {
        vTaskDelay(pdMS_TO_TICKS(stepMs));
        waited += stepMs;
    }
    setState(State::IDLE);
    ledIdle();
    sendData(MAINTENANCE_TOPIC, "{\"status\":\"ok\",\"action\":\"DEEP_CLEAN\"}");
    Serial.println("→ State set to IDLE after DEEP_CLEAN");
    vTaskDelete(nullptr);
}
