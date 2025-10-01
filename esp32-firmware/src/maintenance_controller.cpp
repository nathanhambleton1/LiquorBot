
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

    // Start pump (MOSFET)
    dcPumpOn();

    emptyingSingleIngredient = true;
    currentEmptySlot = ingredientSlot;
    sendData(MAINTENANCE_TOPIC, "{\"status\":\"ok\",\"action\":\"EMPTY_INGREDIENT_START\"}");
}

// Stop emptying the single ingredient
void stopEmptyIngredientTask() {
    // Always perform the stop sequence, regardless of state
    Serial.println("[FORCE STOP] Stopping EMPTY_INGREDIENT sequence (if running)");
    // Close all ingredient slots
    for (uint8_t slot = 1; slot <= 14; ++slot) {
        dcSetSpiSlot(slot, false);
    }
    // Stop pump and close outlets
    dcPumpOff();
    dcOutletAllOff();
    setState(State::IDLE);
    ledIdle();
    emptyingSingleIngredient = false;
    currentEmptySlot = 0;
    sendData(MAINTENANCE_TOPIC, "{\"status\":\"ok\",\"action\":\"EMPTY_INGREDIENT_STOP\"}");
    Serial.println("→ State set to IDLE after EMPTY_INGREDIENT (forced or normal)");
}

// Durations are defined in pin_config.h and used by drink_controller. Avoid duplicating here.

// --- FreeRTOS task forward declarations ---
static void readySystemTask(void *param);
static void emptySystemTask(void *param);
static void quickCleanTask(void *param);
// New: run blocking sequences asynchronously
static void customCleanStopTask(void *param);
static void deepCleanFinalFlushTask(void *param);

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

// QUICK_CLEAN – short automatic rinse
void startQuickCleanTask() {
    if (getCurrentState() != State::IDLE) {
        Serial.println("✖ Cannot start QUICK_CLEAN: System not IDLE");
        sendData(MAINTENANCE_TOPIC, "{\"status\":\"fail\",\"action\":\"QUICK_CLEAN\",\"error\":\"busy\"}");
        return;
    }
    if (xTaskCreate(quickCleanTask, "quickCleanTask", 4096, nullptr, 1, nullptr) != pdPASS) {
        Serial.println("❌ Failed to create QUICK_CLEAN task");
        sendData(MAINTENANCE_TOPIC, "{\"status\":\"fail\",\"action\":\"QUICK_CLEAN\",\"error\":\"task_fail\"}");
    }
}

// Custom clean controls – state tracked below
static std::atomic<bool> customActive{false};
static std::atomic<uint8_t> customSlot{0};
static std::atomic<uint8_t> customPhase{1};

void customCleanStart(uint8_t ingredientSlot, uint8_t phase) {
    if (getCurrentState() != State::IDLE) {
        Serial.println("✖ Cannot start CUSTOM_CLEAN: System not IDLE");
        sendData(MAINTENANCE_TOPIC, "{\"status\":\"fail\",\"action\":\"CUSTOM_CLEAN\",\"error\":\"busy\"}");
        return;
    }
    if (ingredientSlot < 1 || ingredientSlot > 12) {
        Serial.println("✖ CUSTOM_CLEAN bad slot");
        sendData(MAINTENANCE_TOPIC, "{\"status\":\"fail\",\"action\":\"CUSTOM_CLEAN\",\"error\":\"bad_slot\"}");
        return;
    }
    setState(State::MAINTENANCE);
    fadeToRed();
    cleanupDrinkController();

    // Route fluid to spout: OUT1=ON, OUT3=ON
    dcOutletSetState(true, false, true, false);
    // Specials closed; open only selected ingredient slot
    dcSetSpiSlot(13, false);
    dcSetSpiSlot(14, false);
    for (uint8_t s = 1; s <= 12; ++s) dcSetSpiSlot(s, s == ingredientSlot);

        // Start pump (MOSFET)
        dcPumpOn();

    customActive = true;
    customSlot = ingredientSlot;
    customPhase = phase;
    // Immediate OK ack for UI "waiting for device"
    {
        char buf[128];
        snprintf(buf, sizeof(buf), "{\"status\":\"OK\",\"action\":\"CUSTOM_CLEAN_OK\",\"mode\":\"CUSTOM_CLEAN\",\"slot\":%u,\"phase\":%u}", (unsigned)ingredientSlot, (unsigned)phase);
        sendData(MAINTENANCE_TOPIC, String(buf));
    }
}

void customCleanStop() {
    // Offload the multi-step sequence to its own task to avoid blocking loop()
    if (xTaskCreate(customCleanStopTask, "customCleanStopTask", 4096, nullptr, 1, nullptr) != pdPASS) {
        Serial.println("❌ Failed to create CUSTOM_CLEAN_STOP task");
        sendData(MAINTENANCE_TOPIC, "{\"status\":\"fail\",\"action\":\"CUSTOM_CLEAN\",\"error\":\"task_fail\"}");
    }
}

void customCleanResume(uint8_t ingredientSlot, uint8_t phase) {
    if (getCurrentState() != State::IDLE) {
        Serial.println("✖ Cannot RESUME CUSTOM_CLEAN: System not IDLE");
        sendData(MAINTENANCE_TOPIC, "{\"status\":\"fail\",\"action\":\"CUSTOM_CLEAN\",\"error\":\"busy\"}");
        return;
    }
        // Start pump (MOSFET)
        dcPumpOn();
}

// Deep clean per-line control
static std::atomic<bool> deepLineActive{false};
static std::atomic<uint8_t> deepLineSlot{0};

void deepCleanStartLine(uint8_t ingredientSlot) {
    if (getCurrentState() != State::IDLE) {
        Serial.println("✖ Cannot start DEEP_CLEAN line: System not IDLE");
        sendData(MAINTENANCE_TOPIC, "{\"status\":\"fail\",\"action\":\"DEEP_CLEAN\",\"error\":\"busy\"}");
        return;
    }
    if (ingredientSlot < 1 || ingredientSlot > 12) {
        sendData(MAINTENANCE_TOPIC, "{\"status\":\"fail\",\"action\":\"DEEP_CLEAN\",\"error\":\"bad_slot\"}");
        return;
    }
    setState(State::MAINTENANCE);
    fadeToRed();
    cleanupDrinkController();
    // Route to spout (Outputs: 1=ON,2=OFF,3=ON,4=OFF)
    dcOutletSetState(true, false, true, false);
    // Open chosen slot only, specials closed (13=water OFF, 14=trash/air OFF)
    for (uint8_t s = 1; s <= 14; ++s) dcSetSpiSlot(s, false);
    dcSetSpiSlot(ingredientSlot, true);

        // Start pump (MOSFET)
        dcPumpOn();

    // Verbose logging for parity with CUSTOM_CLEAN
    Serial.println("[DEEP_CLEAN][START] Per-line deep clean");
    Serial.printf("  - Outputs: [1=ON,2=OFF,3=ON,4=OFF]\n");
    Serial.printf("  - SPI: [slot %u=ON, 13=OFF (water), 14=OFF (trash/air)]\n", (unsigned)ingredientSlot);
    Serial.println("  - Pump ON");
    deepLineActive = true;
    deepLineSlot = ingredientSlot;
    char buf[96];
        snprintf(buf, sizeof(buf), "{\"status\":\"OK\",\"action\":\"DEEP_CLEAN_OK\",\"mode\":\"DEEP_CLEAN\",\"slot\":%u,\"op\":\"START\"}", (unsigned)ingredientSlot);
    sendData(MAINTENANCE_TOPIC, String(buf));
}

void deepCleanStopLine() {
    Serial.println("[DEEP_CLEAN][STOP] Stopping per-line deep clean");
    // Close all SPI solenoids (includes the selected ingredient and specials)
    for (uint8_t s = 1; s <= 14; ++s) dcSetSpiSlot(s, false);
    // Stop pump and close outlets
        dcPumpOff();
    dcOutletAllOff();
    setState(State::IDLE);
    ledIdle();
    deepLineActive = false;
    uint8_t slot = deepLineSlot.load();
        char buf[128];
        snprintf(buf, sizeof(buf), "{\"status\":\"OK\",\"action\":\"DEEP_CLEAN_OK\",\"mode\":\"DEEP_CLEAN\",\"slot\":%u,\"op\":\"STOP\"}", (unsigned)slot);
    sendData(MAINTENANCE_TOPIC, String(buf));
}

void deepCleanFinalFlush() {
    // Keep the public API but run the sequence asynchronously
    if (xTaskCreate(deepCleanFinalFlushTask, "deepCleanFinalFlushTask", 4096, nullptr, 1, nullptr) != pdPASS) {
        Serial.println("❌ Failed to create DEEP_CLEAN_FINAL task");
        sendData(MAINTENANCE_TOPIC, "{\"status\":\"fail\",\"action\":\"DEEP_CLEAN_FINAL\",\"error\":\"task_fail\"}");
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

        // Start pump to draw liquids
        dcPumpOn();

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
        dcPumpOff();
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

    // Run pump for configured time
    dcPumpOn();
    vTaskDelay(pdMS_TO_TICKS(EMPTY_SYSTEM_MS));

    // Close all ingredient slots
    for (uint8_t slot = 1; slot <= maxIngr; ++slot) {
        dcSetSpiSlot(slot, false);
    }
    // Close specials
    dcSetSpiSlot(13, false);
    dcSetSpiSlot(14, false);

    // Stop pump and close outlets
    dcPumpOff();
    dcOutletAllOff();

    setState(State::IDLE);
    ledIdle();
    sendData(MAINTENANCE_TOPIC, "{\"status\":\"ok\",\"action\":\"EMPTY_SYSTEM\"}");
    Serial.println("→ State set to IDLE after EMPTY_SYSTEM");
    vTaskDelete(nullptr);
}

// --- Task impls ---
static void quickCleanTask(void *param) {
    setState(State::MAINTENANCE);
    fadeToRed();
    Serial.println("→ State set to MAINTENANCE (QUICK_CLEAN)");
    cleanupDrinkController();
    // STEP 1: Water forward flush to spout (outputs 1 & 3)
    // Route to spout
    dcOutletSetState(true, false, true, false);
    // Open water, close trash
    dcSetSpiSlot(13, true);
    dcSetSpiSlot(14, false);
    // Ingredients closed
    for (uint8_t s = 1; s <= dcGetIngredientCount(); ++s) dcSetSpiSlot(s, false);
    // Pump forward
    dcPumpOn();
    Serial.println("[QUICK_CLEAN][STEP 1] Water flush to spout");
    Serial.println("  - Outputs: [1=ON,2=OFF,3=ON,4=OFF], SPI: [13=ON (water),14=OFF], Ingredients 1..N=OFF");
    Serial.printf("  - Pump ON for QUICK_CLEAN_MS=%u ms\n", (unsigned)QUICK_CLEAN_MS);
    // Run for configured quick-clean duration
    vTaskDelay(pdMS_TO_TICKS(QUICK_CLEAN_MS));

    // STEP 2: Air purge at the top/spout path (outputs 1 & 4)
    Serial.println("[QUICK_CLEAN][STEP 2] Air purge at top/spout");
    // Close water; keep trash closed
    dcSetSpiSlot(13, false);
    dcSetSpiSlot(14, false);
    // Outputs: 1=ON, 2=OFF, 3=OFF, 4=ON
    dcOutletSetState(true, false, false, true);
    // Pump continues running
    Serial.println("  - Outputs: [1=ON,2=OFF,3=OFF,4=ON], SPI: [13=OFF,14=OFF]");
    Serial.printf("  - Pump ON for CLEAN_AIR_TOP_MS=%u ms\n", (unsigned)CLEAN_AIR_TOP_MS);
    vTaskDelay(pdMS_TO_TICKS(CLEAN_AIR_TOP_MS));

    // STEP 3: Backflow to trash
    Serial.println("[QUICK_CLEAN][STEP 3] Backflow to trash");
    // Outputs: 1=OFF, 2=ON, 3=OFF, 4=ON
    dcOutletSetState(false, true, false, true);
    // Open trash/air SPI slot
    dcSetSpiSlot(14, true);
    // Pump continues running
    Serial.println("  - Outputs: [1=OFF,2=ON,3=OFF,4=ON], SPI: [13=OFF,14=ON]");
    Serial.printf("  - Pump ON for CLEAN_TRASH_MS=%u ms\n", (unsigned)CLEAN_TRASH_MS);
    vTaskDelay(pdMS_TO_TICKS(CLEAN_TRASH_MS));

    // STEP 4: Shutdown and report
    Serial.println("[QUICK_CLEAN][STEP 4] Shutdown – closing all solenoids and stopping pump");
    for (uint8_t s = 1; s <= 14; ++s) dcSetSpiSlot(s, false);
    dcPumpOff();
    dcOutletAllOff();
    setState(State::IDLE);
    ledIdle();
    sendData(MAINTENANCE_TOPIC, "{\"status\":\"OK\",\"action\":\"QUICK_CLEAN_OK\",\"mode\":\"QUICK_CLEAN\"}");
    vTaskDelete(nullptr);
}

// --- New async task bodies -------------------------------------------------
static void customCleanStopTask(void *param) {
    Serial.println("→ CUSTOM_CLEAN STOP pressed: starting post-clean sequence");
    // Stay in MAINTENANCE until the sequence completes
    setState(State::MAINTENANCE);
    fadeToRed();

    const uint8_t maxIngr = dcGetIngredientCount();

    // STEP 1: Water forward flush to clear the selected line remnants
    Serial.println("[CUSTOM_CLEAN][STEP 1] Water flush");
    // Close all ingredient slots 1..N
    for (uint8_t s = 1; s <= maxIngr; ++s) dcSetSpiSlot(s, false);
    // Specials: 13 (water)=ON, 14 (trash/air)=OFF
    dcSetSpiSlot(13, true);
    dcSetSpiSlot(14, false);
    // Outputs: 1=ON, 2=OFF, 3=ON, 4=OFF (route to spout)
    dcOutletSetState(true, false, true, false);
    Serial.println("  - Outputs: [1=ON,2=OFF,3=ON,4=OFF], SPI: [13=ON (water),14=OFF], Ingredients 1..N=OFF");
    // Pump forward
    dcPumpOn();
    Serial.printf("  - Pump ON for CLEAN_WATER_MS=%u ms\n", (unsigned)CLEAN_WATER_MS);
    vTaskDelay(pdMS_TO_TICKS(CLEAN_WATER_MS));

    // STEP 2: Air purge at the top/spout path (1 & 4)
    Serial.println("[CUSTOM_CLEAN][STEP 2] Air purge at top/spout");
    // Close water; keep trash closed
    dcSetSpiSlot(13, false);
    dcSetSpiSlot(14, false);
    // Outputs: 1=ON, 2=OFF, 3=OFF, 4=ON
    dcOutletSetState(true, false, false, true);
    // Pump continues running
    Serial.println("  - Outputs: [1=ON,2=OFF,3=OFF,4=ON], SPI: [13=OFF,14=OFF]");
    Serial.printf("  - Pump ON for CLEAN_AIR_TOP_MS=%u ms\n", (unsigned)CLEAN_AIR_TOP_MS);
    vTaskDelay(pdMS_TO_TICKS(CLEAN_AIR_TOP_MS));

    // STEP 3: Backflow to trash
    Serial.println("[CUSTOM_CLEAN][STEP 3] Backflow to trash");
    // Outputs: 1=OFF, 2=ON, 3=OFF, 4=ON
    dcOutletSetState(false, true, false, true);
    // Open trash/air SPI slot
    dcSetSpiSlot(14, true);
    // Pump continues running
    Serial.println("  - Outputs: [1=OFF,2=ON,3=OFF,4=ON], SPI: [13=OFF,14=ON]");
    Serial.printf("  - Pump ON for CLEAN_TRASH_MS=%u ms\n", (unsigned)CLEAN_TRASH_MS);
    vTaskDelay(pdMS_TO_TICKS(CLEAN_TRASH_MS));

    // STEP 4: Shutdown and report
    Serial.println("[CUSTOM_CLEAN][STEP 4] Shutdown – closing all solenoids and stopping pump");
    for (uint8_t s = 1; s <= 14; ++s) dcSetSpiSlot(s, false);
    dcPumpOff();
    dcOutletAllOff();
    setState(State::IDLE);
    ledIdle();
    customActive = false;
    uint8_t slot = customSlot.load();
    uint8_t phase = customPhase.load();
    char buf[160];
    snprintf(buf, sizeof(buf), "{\"status\":\"OK\",\"action\":\"CUSTOM_CLEAN_OK\",\"mode\":\"CUSTOM_CLEAN\",\"op\":\"STOP\",\"slot\":%u,\"phase\":%u}", (unsigned)slot, (unsigned)phase);
    sendData(MAINTENANCE_TOPIC, String(buf));
    vTaskDelete(nullptr);
}

static void deepCleanFinalFlushTask(void *param) {
    if (getCurrentState() != State::IDLE) {
        Serial.println("✖ Cannot start DEEP_CLEAN_FINAL: System not IDLE");
        sendData(MAINTENANCE_TOPIC, "{\"status\":\"fail\",\"action\":\"DEEP_CLEAN_FINAL\",\"error\":\"busy\"}");
        vTaskDelete(nullptr);
        return;
    }
    setState(State::MAINTENANCE);
    fadeToRed();
    cleanupDrinkController();
    // STEP 1: Water forward flush to spout (outputs 1 & 3), ingredients closed, water open
    Serial.println("[DEEP_CLEAN_FINAL][STEP 1] Water flush to spout");
    // Route to spout
    dcOutletSetState(true, false, true, false);
    // Close ingredients 1..N
    for (uint8_t s = 1; s <= dcGetIngredientCount(); ++s) dcSetSpiSlot(s, false);
    // Open water, close trash/air
    dcSetSpiSlot(13, true);
    dcSetSpiSlot(14, false);
    // Pump forward
    dcPumpOn();
    Serial.println("  - Outputs: [1=ON,2=OFF,3=ON,4=OFF], SPI: [13=ON (water),14=OFF], Ingredients 1..N=OFF");
    Serial.printf("  - Pump ON for CLEAN_WATER_MS=%u ms\n", (unsigned)CLEAN_WATER_MS);
    vTaskDelay(pdMS_TO_TICKS(CLEAN_WATER_MS));

    // STEP 2: Air purge at the top/spout path (outputs 1 & 4); water OFF
    Serial.println("[DEEP_CLEAN_FINAL][STEP 2] Air purge at top/spout");
    dcSetSpiSlot(13, false); // close water
    dcSetSpiSlot(14, false); // keep trash closed for this step
    // Outputs: 1=ON,2=OFF,3=OFF,4=ON
    dcOutletSetState(true, false, false, true);
    // Pump continues running
    Serial.println("  - Outputs: [1=ON,2=OFF,3=OFF,4=ON], SPI: [13=OFF,14=OFF]");
    Serial.printf("  - Pump ON for CLEAN_AIR_TOP_MS=%u ms\n", (unsigned)CLEAN_AIR_TOP_MS);
    vTaskDelay(pdMS_TO_TICKS(CLEAN_AIR_TOP_MS));

    // STEP 3: Backflow to trash (outputs 2 & 4), open trash/air valve; water OFF
    Serial.println("[DEEP_CLEAN_FINAL][STEP 3] Backflow to trash");
    // Outputs: 1=OFF, 2=ON, 3=OFF, 4=ON
    dcOutletSetState(false, true, false, true);
    dcSetSpiSlot(13, false);
    dcSetSpiSlot(14, true);
    // Pump continues running
    Serial.println("  - Outputs: [1=OFF,2=ON,3=OFF,4=ON], SPI: [13=OFF,14=ON]");
    Serial.printf("  - Pump ON for CLEAN_TRASH_MS=%u ms\n", (unsigned)CLEAN_TRASH_MS);
    vTaskDelay(pdMS_TO_TICKS(CLEAN_TRASH_MS));

    // STEP 4: Shutdown
    Serial.println("[DEEP_CLEAN_FINAL][STEP 4] Shutdown – closing all solenoids and stopping pump");
    for (uint8_t s = 1; s <= 14; ++s) dcSetSpiSlot(s, false);
    dcPumpOff();
    dcOutletAllOff();
    setState(State::IDLE);
    ledIdle();
    sendData(MAINTENANCE_TOPIC, "{\"status\":\"OK\",\"action\":\"DEEP_CLEAN_OK\",\"mode\":\"DEEP_CLEAN_FINAL\",\"op\":\"FINAL\"}");
    vTaskDelete(nullptr);
}
