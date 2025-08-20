
/*  maintenance_controller.cpp
 *  Handles system maintenance actions (priming, cleaning, emptying, etc.)
 *  Integrates with state_manager and aws_manager for robust state and cloud communication.
 *  Author: Nathan Hambleton – 2025
 * -------------------------------------------------------------------------- */

#include <Arduino.h>
#include <atomic>
#include "maintenance_controller.h"
#include "state_manager.h"
#include "aws_manager.h"
#include "led_control.h"
#include "pin_config.h"
#include "drink_controller.h"

// --- Single-ingredient emptying state ---
static std::atomic<bool> emptyingSingleIngredient{false};
static uint8_t currentEmptySlot = 0;

// Start emptying a single ingredient (slot 1-12)
void startEmptyIngredientTask(uint8_t ingredientSlot) {
    if (getCurrentState() != State::IDLE) {
        Serial.println("✖ Cannot start EMPTY_INGREDIENT: System not IDLE");
        sendData(MAINTENANCE_TOPIC, "{\"status\":\"fail\",\"error\":\"busy\"}");
        return;
    }
    if (ingredientSlot < 1 || ingredientSlot > 12) {
        Serial.println("✖ Invalid ingredient slot for EMPTY_INGREDIENT");
        sendData(MAINTENANCE_TOPIC, "{\"status\":\"fail\",\"error\":\"bad_slot\"}");
        return;
    }
    setState(State::MAINTENANCE);
    fadeToRed();
    Serial.printf("→ State set to MAINTENANCE (EMPTY_INGREDIENT %u)\n", (unsigned)ingredientSlot);
    cleanupDrinkController();

    // Output path: OUT1=ON, OUT2=OFF, OUT3=ON, OUT4=OFF
    dcOutletSetState(true, false, true, false);
    // Ensure WATER and TRASH/AIR are OFF
    dcSetSpiSlot(13, false);
    dcSetSpiSlot(14, false);

    // Open only the selected ingredient slot
    for (uint8_t slot = 1; slot <= 12; ++slot) {
        dcSetSpiSlot(slot, slot == ingredientSlot);
    }

    // Start pump forward at water duty
    dcPumpForward(true);
    dcPumpSetDuty(PUMP_WATER_DUTY);

    emptyingSingleIngredient = true;
    currentEmptySlot = ingredientSlot;
    sendData(MAINTENANCE_TOPIC, "{\"status\":\"ok\",\"action\":\"EMPTY_INGREDIENT_START\"}");
}

// Stop emptying the single ingredient
void stopEmptyIngredientTask() {
    if (!emptyingSingleIngredient) {
        Serial.println("✖ No EMPTY_INGREDIENT in progress");
        sendData(MAINTENANCE_TOPIC, "{\"status\":\"fail\",\"error\":\"not_running\"}");
        return;
    }
    // Close all ingredient slots
    for (uint8_t slot = 1; slot <= 14; ++slot) {
        dcSetSpiSlot(slot, false);
    }
    // Stop pump and close outlets
    dcPumpStop();
    dcOutletAllOff();
    setState(State::IDLE);
    ledIdle();
    emptyingSingleIngredient = false;
    currentEmptySlot = 0;
    sendData(MAINTENANCE_TOPIC, "{\"status\":\"ok\",\"action\":\"EMPTY_INGREDIENT_STOP\"}");
    Serial.println("→ State set to IDLE after EMPTY_INGREDIENT");
}

// Durations are defined in pin_config.h and used by drink_controller. Avoid duplicating here.

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
        // "Load Ingredients" / prime each ingredient line (1..N) individually
        setState(State::MAINTENANCE);
        fadeToRed();
        Serial.println("→ State set to MAINTENANCE (LOAD_INGREDIENTS)");

        // Safety baseline: close all SPI slots, stop pump, close all outlets
        cleanupDrinkController();

        // Output path for priming: OUT1=ON, OUT3=ON, OUT2=OFF, OUT4=OFF
        dcOutletSetState(true, false, true, false);
        // Ensure SPI specials are CLOSED (13=water, 14=trash/air)
        dcSetSpiSlot(13, false);
        dcSetSpiSlot(14, false);

        // Per-slot prime durations (ms). Adjustable to account for tube length.
        // Defaults chosen conservatively; tailor to your machine.
        const uint8_t maxIngr = dcGetIngredientCount(); // 0..12 based on device ID
        const uint32_t defaultMs = 1200; // 1.2s baseline
        uint32_t primeMs[12] = {
            1200, // 1
            1200, // 2
            1200, // 3
            1200, // 4
            1400, // 5 (example: longer run)
            1400, // 6
            1000, // 7 (example: shorter)
            1000, // 8
            1300, // 9
            1300, // 10
            1500, // 11
            1500  // 12
        };

        // Start pump forward at water duty to draw liquids
        dcPumpForward(true);
        dcPumpSetDuty(PUMP_WATER_DUTY);

        // Loop ingredients 1..maxIngr, one-at-a-time, quick succession
        for (uint8_t slot = 1; slot <= maxIngr; ++slot) {
                // Open only this slot; others remain closed
                Serial.printf("[LOAD] Priming slot %u for %u ms\n", (unsigned)slot,
                                            (unsigned)primeMs[slot-1]);
                // Make sure specials closed every iteration
                dcSetSpiSlot(13, false);
                dcSetSpiSlot(14, false);
                // Open this ingredient
                dcSetSpiSlot(slot, true);
                vTaskDelay(pdMS_TO_TICKS(primeMs[slot-1]));
                dcSetSpiSlot(slot, false);
                // tiny inter-slot gap to avoid water-hammer
                vTaskDelay(pdMS_TO_TICKS(60));
        }

        // Stop pump and close outlets
        dcPumpStop();
        dcOutletAllOff();

        sendData(MAINTENANCE_TOPIC, "{\"status\":\"ok\",\"action\":\"LOAD_INGREDIENTS\"}");
        setState(State::IDLE);
        ledIdle();
        Serial.println("→ State set to IDLE after LOAD_INGREDIENTS");
        vTaskDelete(nullptr);
}

static void emptySystemTask(void *param) {
    // "Empty System" / backflow: open 1..12 together and push contents back
    setState(State::MAINTENANCE);
    fadeToRed();
    Serial.println("→ State set to MAINTENANCE (EMPTY_SYSTEM)");

    // Baseline safe
    cleanupDrinkController();

    // Output routing for backflow: OUT1=OFF, OUT2=ON, OUT3=OFF, OUT4=ON
    dcOutletSetState(false, true, false, true);

    // Ensure WATER and TRASH/AIR are OPEN during empty
    dcSetSpiSlot(13, true);
    dcSetSpiSlot(14, true);

    // Open all ingredient slots (1..N) together
    const uint8_t maxIngr = dcGetIngredientCount();
    for (uint8_t slot = 1; slot <= maxIngr; ++slot) {
        dcSetSpiSlot(slot, true);
    }

    // Run pump forward for configured time (use air duty to be gentler)
    dcPumpForward(true);
    dcPumpSetDuty(PUMP_AIR_DUTY);
    vTaskDelay(pdMS_TO_TICKS(EMPTY_SYSTEM_MS));

    // Close all ingredient slots
    for (uint8_t slot = 1; slot <= maxIngr; ++slot) {
        dcSetSpiSlot(slot, false);
    }
    // Close specials
    dcSetSpiSlot(13, false);
    dcSetSpiSlot(14, false);

    // Stop pump and close outlets
    dcPumpStop();
    dcOutletAllOff();

    setState(State::IDLE);
    ledIdle();
    sendData(MAINTENANCE_TOPIC, "{\"status\":\"ok\",\"action\":\"EMPTY_SYSTEM\"}");
    Serial.println("→ State set to IDLE after EMPTY_SYSTEM");
    vTaskDelete(nullptr);
}

static void deepCleanTask(void *param) {
    setState(State::MAINTENANCE);
    fadeToRed();
    Serial.println("→ State set to MAINTENANCE (DEEP_CLEAN)");
    // Ensure all solenoids are closed, stop pump
    cleanupDrinkController();
    Serial.println("Starting deep clean sequence (water replace + full draw)");

    // Route: OUT1=ON, OUT2=OFF, OUT3=ON, OUT4=OFF
    dcOutletSetState(true, false, true, false);

    // Open all ingredient slots 1..N and the water feed (13)
    const uint8_t maxIngr = dcGetIngredientCount();
    for (uint8_t slot = 1; slot <= maxIngr; ++slot) dcSetSpiSlot(slot, true);
    dcSetSpiSlot(13, true);   // water supply on
    dcSetSpiSlot(14, false);  // trash/air closed per your spec

    // Run pump forward at water duty for DEEP_CLEAN_MS
    dcPumpForward(true);
    dcPumpSetDuty(PUMP_WATER_DUTY);
    vTaskDelay(pdMS_TO_TICKS(DEEP_CLEAN_MS));

    // Close all
    for (uint8_t slot = 1; slot <= maxIngr; ++slot) dcSetSpiSlot(slot, false);
    dcSetSpiSlot(13, false);
    dcSetSpiSlot(14, false);
    dcPumpStop();
    dcOutletAllOff();

    Serial.println("Deep clean sequence complete");
    sendData(MAINTENANCE_TOPIC, "{\"status\":\"ok\",\"action\":\"DEEP_CLEAN\"}");
    setState(State::IDLE);
    ledIdle();
    Serial.println("→ State set to IDLE after DEEP_CLEAN");
    vTaskDelete(nullptr);
}
