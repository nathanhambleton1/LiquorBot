/*  drink_controller.cpp  – OLD-HARDWARE (GPIO) BACK-PORT
 *  Works with the original MOSFET-driven LiquorBot (individual GPIO pins)
 *  Author: Nathan Hambleton – back-port 08 Jun 2025 by ChatGPT
 * -------------------------------------------------------------------------- */

#include <Arduino.h>
#include <vector>
#include <algorithm>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <ArduinoJson.h>  // Include ArduinoJson library for JSON handling

#include "state_manager.h"   // setState(), isBusy()
#include "aws_manager.h"     // notifyPourResult()
#include "pin_config.h"      // PUMP1_PIN (use DRIVER1+ 17)
#include "led_control.h"

#ifndef PUMP1_PIN
#define PUMP1_PIN   17      /* DRIVER1_POS  – forward */
#endif

/* ---------------- SOLENOID + OUTPUT PINS (original hardware) -------------- */
#define SOL_OUTPUT_PIN  23   // Combined outlet valve (was SOL_OUTPUT)

static const uint8_t SOL_PINS[13] = {
    13,  /* SOL_1  */
    12,  /* SOL_2  */
    14,  /* SOL_3  */
    27,  /* SOL_4  */
    26,  /* SOL_5  */
    25,  /* SOL_6  */
    33,  /* SOL_7  */
    19,  /* SOL_8  */
    18,  /* SOL_9  */
     5,  /* SOL_10 */
     4,  /* SOL_11 */
    32,  /* SOL_12 */
    21   /* SOL_13 */
};

/* ---------------------------- TYPES --------------------------------------- */
struct IngredientCommand {
    int   slot;      // 1-13  (14-16 ignored on old hardware)
    float amount;    // ounces
    int   priority;  // lower = earlier
};

/* ------------------------ FORWARD DECLS ----------------------------------- */
static void setSolenoid(int slot, bool on);
static void dispenseDrink(std::vector<IngredientCommand> &parsed);
static std::vector<IngredientCommand> parseDrinkCommand(const String &str);
static void pourDrinkTask(void *param);
static float flowRate(int numOpen);
static void dispenseParallelGroup(std::vector<IngredientCommand> &group);
static void cleanupDrinkController();
static float estimatePourTime(const std::vector<IngredientCommand> &parsed);

/* -------------------------------------------------------------------------- */
/*                           INITIALISATION                                   */
/* -------------------------------------------------------------------------- */
void initDrinkController() {
    /* Pump */
    pinMode(PUMP1_PIN, OUTPUT);
    digitalWrite(PUMP1_PIN, LOW);

    /* Common outlet */
    pinMode(SOL_OUTPUT_PIN, OUTPUT);
    digitalWrite(SOL_OUTPUT_PIN, LOW);

    /* 13 individual solenoids */
    for (uint8_t i = 0; i < 13; ++i) {
        pinMode(SOL_PINS[i], OUTPUT);
        digitalWrite(SOL_PINS[i], LOW);
    }

    Serial.println("GPIO drink controller ready (old hardware).");
}

/* ------------------------ PUBLIC API (FreeRTOS task starter) ---------------- */
void startPourTask(const String &commandStr) {
    // Allocate memory for command string (FreeRTOS-safe)
    char *raw = static_cast<char*>(pvPortMalloc(commandStr.length() + 1));
    if (!raw) {
        Serial.println("❌ Failed to allocate memory for pour task");
        setState(State::ERROR);
        ledError();
        notifyPourResult(false, "alloc_fail");
        return;
    }
    strcpy(raw, commandStr.c_str());

    // Create FreeRTOS task
    if (xTaskCreate(
        pourDrinkTask,   // Task function
        "pourTask",      // Task name
        4096,            // Stack size
        raw,             // Parameter (command string)
        1,               // Priority
        nullptr          // Task handle
    ) != pdPASS) {
        Serial.println("❌ Failed to create pour task");
        setState(State::ERROR);
        ledError();
        vPortFree(raw);
        notifyPourResult(false, "task_fail");
    }
}

/* -------------------------------------------------------------------------- */
/*                     PUBLIC API – kicks off FreeRTOS task                   */
/* -------------------------------------------------------------------------- */
static void pourDrinkTask(void *param) {
    char *raw = static_cast<char *>(param);
    String cmd(raw);
    free(raw);

    setState(State::POURING);
    Serial.println("→ State set to POURING");
    ledPouring();

    auto parsed = parseDrinkCommand(cmd);
    if (parsed.empty()) {
        notifyPourResult(false, "empty_command");
        setState(State::ERROR);
        ledError();
        vTaskDelete(nullptr);
    }

    // --- NEW LOGGING START ---
    Serial.println("📋 Recipe details:");
    for (auto &ic : parsed) {
        Serial.printf("   • Slot %2d → %5.2f oz   (prio %d)\n",
                      ic.slot, ic.amount, ic.priority);
    }
    float eta = estimatePourTime(parsed);
    Serial.printf("Estimated total pour time: %.2f s\n", eta);
    Serial.println("--------------------------");
    {
       StaticJsonDocument<64> doc;
       doc["status"] = "eta";          // special flag
       doc["eta"]    = eta;            // seconds (float)
       String out;
       serializeJson(doc, out);
       sendData(AWS_RECEIVE_TOPIC, out);
   }
   
    // --- NEW LOGGING END ---

    dispenseDrink(parsed);

    notifyPourResult(true, nullptr);
    setState(State::IDLE);
    Serial.println("→ State set to IDLE");
    ledIdle();
    Serial.println("✅ Pour complete");
    vTaskDelete(nullptr);
}

/* -------------------------------------------------------------------------- */
/*                   ESTIMATE TOTAL POUR TIME (in seconds)                    */
/* -------------------------------------------------------------------------- */
static float estimatePourTime(const std::vector<IngredientCommand> &parsed) {
    // make a local copy and sort by priority
    auto v = parsed;
    std::sort(v.begin(), v.end(),
              [](const IngredientCommand &a, const IngredientCommand &b){ return a.priority < b.priority; });

    float totalSec = 0.0f;
    size_t i = 0;
    while (i < v.size()) {
        int pr = v[i].priority;
        float groupSumOz = 0.0f;
        int   count     = 0;
        // gather this priority group
        while (i < v.size() && v[i].priority == pr) {
            groupSumOz += v[i].amount;
            count++;
            i++;
        }
        float rate = flowRate(count);         // oz/sec for count open solenoids
        if (rate > 0.0f) {
            totalSec += groupSumOz / rate;
        }
    }
    return totalSec;
}

/* -------------------------------------------------------------------------- */
/*                             PARSE LOGIC                                    */
/* -------------------------------------------------------------------------- */
static std::vector<IngredientCommand> parseDrinkCommand(const String &commandStr) {
    std::vector<IngredientCommand> parsed;
    int start = 0;
    while (true) {
        int comma = commandStr.indexOf(',', start);
        String seg = (comma == -1)
                     ? commandStr.substring(start)
                     : commandStr.substring(start, comma);
        seg.trim();
        if (seg.length()) {
            int c1 = seg.indexOf(':');
            int c2 = seg.indexOf(':', c1 + 1);
            if (c1 != -1) {
                IngredientCommand ic;
                ic.slot = seg.substring(0, c1).toInt();
                if (c2 != -1) {
                    ic.amount   = seg.substring(c1 + 1, c2).toFloat();
                    ic.priority = seg.substring(c2 + 1).toInt();
                } else {
                    ic.amount   = seg.substring(c1 + 1).toFloat();
                    ic.priority = 99;
                }
                parsed.push_back(ic);
            }
        }
        if (comma == -1) break;
        start = comma + 1;
    }
    return parsed;
}

/* -------------------------------------------------------------------------- */
/*                       DISPENSE  (priority groups)                          */
/* -------------------------------------------------------------------------- */
static void dispenseDrink(std::vector<IngredientCommand> &parsed) {
    /* Open outlet & start pump */
    digitalWrite(SOL_OUTPUT_PIN, HIGH);
    digitalWrite(PUMP1_PIN, HIGH);
    Serial.println("Pump ON, outlet open.");

    /* Sort commands by priority ASC */
    std::sort(parsed.begin(), parsed.end(),
              [](const IngredientCommand &a, const IngredientCommand &b) {
                  return a.priority < b.priority;
              });

    size_t i = 0;
    while (i < parsed.size()) {
        int currentPr = parsed[i].priority;
        std::vector<IngredientCommand> group;
        while (i < parsed.size() && parsed[i].priority == currentPr) {
            group.push_back(parsed[i]);
            ++i;
        }
        Serial.printf("\n— Priority %d (%u items) —\n", currentPr, group.size());
        dispenseParallelGroup(group);
    }

    /* Stop pump & close outlet */
    digitalWrite(PUMP1_PIN, LOW);
    digitalWrite(SOL_OUTPUT_PIN, LOW);
    Serial.println("Pump OFF, outlet closed.");

    cleanupDrinkController();
}

/* ----------------------- PARALLEL GROUP DISPENSE --------------------------- */
struct PourState {
    int   slot;
    float ouncesLeft;
    bool  done;
};

static void dispenseParallelGroup(std::vector<IngredientCommand> &group) {
    std::vector<PourState> pours;
    for (auto &ic : group) {
        /* skip slots > 13 (not wired on old hardware) */
        if (ic.slot < 1 || ic.slot > 13) continue;
        pours.push_back({ ic.slot, ic.amount, false });
    }
    if (pours.empty()) return;

    const unsigned long stepMs  = 50;
    const float         stepSec = 0.05f;

    while (true) {
        int openCnt = 0;
        float needSum = 0;
        for (auto &p : pours) {
            if (!p.done && p.ouncesLeft > 0.0f) {
                openCnt++;
                needSum += p.ouncesLeft;
            }
        }
        if (openCnt == 0) break;

        for (auto &p : pours) {
            setSolenoid(p.slot, !p.done && p.ouncesLeft > 0.0f);
        }

        float totalFlow = flowRate(openCnt);
        for (auto &p : pours) {
            if (p.done || p.ouncesLeft <= 0.0f) continue;
            float frac   = p.ouncesLeft / needSum;
            float dispOz = totalFlow * frac * stepSec;
            p.ouncesLeft -= dispOz;
            if (p.ouncesLeft <= 0.0f) {
                p.done = true;
                setSolenoid(p.slot, false);
            }
        }
        delay(stepMs);
    }

    /* ensure all OFF */
    for (auto &p : pours) setSolenoid(p.slot, false);
}

/* ------------------------ SUPPORT FUNC HELPERS ----------------------------- */
static void setSolenoid(int slot, bool on) {
    if (slot < 1 || slot > 13) return;
    digitalWrite(SOL_PINS[slot - 1], on ? HIGH : LOW);
}

/* ------------------------ FLOW RATE CALCULATION ----------------------------- */
static float flowRate(int n) {            /* time is in total oz/sec */
    switch (n) {
        case 1:  return 1.0f;
        case 2:  return 1.4f;
        case 3:  return 1.6f;
        case 4:  return 1.7f;
        default: return 1.8f;             /* 5+ */
    }
}

static void cleanupDrinkController() {
    for (uint8_t i = 0; i < 13; ++i) digitalWrite(SOL_PINS[i], LOW);
    digitalWrite(SOL_OUTPUT_PIN, LOW);
}

/* -------------------------------------------------------------------------- */
