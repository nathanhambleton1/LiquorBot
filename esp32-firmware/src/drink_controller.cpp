/*
 * ----------------------------------------------------------------------------
 *  Project: Liquor Bot
 *  File:    drink_controller.cpp — SPI (NCV7240 x2) + DRV8870 pump
 *  Target:  ESP32 (Arduino) — non‑blocking (FreeRTOS task)
 *
 *  Summary:
 *    • Two daisy‑chained NCV7240 octal low‑side drivers over SPI control 14 solenoids
 *      — Board A (near MCU) : slots 1..8  (only 1..6 used if your harness is 6‑up)
 *      — Board B (far MCU)  : slots 9..16 (we use 7..14 → map to 9..16 internally)
 *      — Slot mapping: 1‑12 = ingredients, 13 = WATER flush, 14 = TRASH / AIR purge
 *    • One pump via DRV8870 H‑bridge (IN1/IN2), simple PWM on IN1 for speed control
 *    • Non‑blocking pour: command string "slot:ounces[:priority],..." → FreeRTOS task
 *    • Parallel time‑slicing per priority group, proportional allocation by remaining oz
 *    • Fault‑tolerant NCV7240 writes: clears channel latches before each pour
 *    • ETA pre‑publish to AWS (sendData(...)) before starting dispense
 *
 *  Notes:
 *    - NCV7240 SPI: 16‑bit frames, MSB first, Mode 1 (CPOL=0, CPHA=1).
 *      Each channel uses 2 bits (00=STBY, 01=INPUT, 10=ON, 11=OFF).
 *    - Daisy‑chain order: send FAR device word first, NEAR device word last.
 *    - DRV8870 truth table (IN1/IN2): 10=Forward (drive), 01=Reverse, 11=Brake, 00=Coast/Sleep.
 *
 *  Author: You & ChatGPT — Aug 2025
 * ----------------------------------------------------------------------------
 */

#include <Arduino.h>
#include <SPI.h>
#include <vector>
#include <algorithm>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <ArduinoJson.h>

#include "drink_controller.h"
#include "pin_config.h"      // central pin & timing configuration
#include "state_manager.h"
#include "aws_manager.h"     // notifyPourResult(), sendData(), LIQUORBOT_ID
#include "led_control.h"

/* All pin / timing constants now come exclusively from pin_config.h.
 * Removed legacy fallback #defines (SPI_MOSI, SPI_MISO, SPI_SCK, SPI_CS,
 * PUMP_IN1_PIN, PUMP_IN2_PIN, NCV_EN_PIN, NCV_LHI_PIN, PUMP_PWM_CHANNEL/FREQ/RES,
 * CLEAN_WATER_MS, CLEAN_AIR_MS). Update pin_config.h to change hardware mapping.
 */

/* -------------------------- NCV7240 SPI encoding ---------------------------- */
static constexpr uint8_t NCV_CMD_STBY  = 0b00; // clears channel fault
static constexpr uint8_t NCV_CMD_INPUT = 0b01; // INx parallel control (unused here)
static constexpr uint8_t NCV_CMD_ON    = 0b10; // output ON (low‑side sinks current)
static constexpr uint8_t NCV_CMD_OFF   = 0b11; // output OFF

/* Two devices in chain: index 0 = NEAR (slots 1..8), index 1 = FAR (slots 9..16) */
static uint16_t ncvWord[2] = { 0xFFFF, 0xFFFF }; // default all channels OFF (11)

/* -------------------------- Types ---------------------------- */
struct PourState { int slot; float ouncesLeft; bool done; };

/* Forward decls */
static void         pumpSetup();
static void         pumpForward(bool on);
static void         pumpSetPWMDuty(uint8_t duty); // 0..255, on IN1 (drive/coast PWM)
static void         pumpStop();
static void         ncvSetup();
static void         ncvFlush();
static inline void  ncvSetPair(uint16_t &word, uint8_t ch/*1..8*/, uint8_t cmd);
static void         ncvSetSlot(int slot/*1..16*/, bool on);
static void         ncvAll(uint8_t cmd);
static void         ncvWriteBoth();
static void         dispenseParallelGroup(std::vector<IngredientCommand> &group);
static float        flowRate(int numOpen);
static uint8_t      getIngredientCountFromId();
static bool         isValidIngredientSlot(int slot);
static float        estimatePourTime(const std::vector<IngredientCommand> &parsed);
static void         pourDrinkTask(void *param);

/* ============================================================================================ */
/*                                           INIT                                               */
/* ============================================================================================ */
void initDrinkController() {
  // SPI for NCV7240
  SPI.begin(SPI_SCK, SPI_MISO, SPI_MOSI, SPI_CS);
  pinMode(SPI_CS, OUTPUT);
  digitalWrite(SPI_CS, HIGH);
  // Optional control pins
  if (NCV_EN_PIN >= 0) { pinMode(NCV_EN_PIN, OUTPUT); digitalWrite(NCV_EN_PIN, HIGH); }
  if (NCV_LHI_PIN >= 0) { pinMode(NCV_LHI_PIN, OUTPUT); digitalWrite(NCV_LHI_PIN, LOW); }
  ncvSetup();

  // DRV8870 pump
  pumpSetup();

  Serial.println("DrinkController: SPI+NCV7240 ready, pump ready.");
}

/* ============================================================================================ */
/*                                   PUBLIC API (non‑blocking)                                  */
/* ============================================================================================ */
void startPourTask(const String &commandStr) {
  char *buf = strdup(commandStr.c_str());
  if (!buf) {
    Serial.println("❌ strdup failed – OOM");
    setState(State::ERROR);
    ledError();
    notifyPourResult(false, "alloc_fail");
    return;
  }
  if (xTaskCreatePinnedToCore(pourDrinkTask, "PourTask", 8192, buf, 1, nullptr, 1) != pdPASS) {
    Serial.println("❌ xTaskCreatePinnedToCore failed");
    setState(State::ERROR);
    ledError();
    free(buf);
    notifyPourResult(false, "task_fail");
  }
}

/* ============================================================================================ */
/*                                   FREE RTOS TASK                                             */
/* ============================================================================================ */
static void pourDrinkTask(void *param) {
  char *raw = static_cast<char*>(param);
  String cmdStr(raw);
  free(raw);

  setState(State::POURING);
  ledPouring();
  Serial.println("→ State set to POURING");

  // Parse command
  auto parsed = parseDrinkCommand(cmdStr);
  // Filter to valid slots (ingredient slots 1..N + 13/14)
  {
    std::vector<IngredientCommand> filtered;
    for (auto &c : parsed) {
      if (isValidIngredientSlot(c.slot)) filtered.push_back(c);
      else Serial.printf("(skip slot %d – not present on this device)\n", c.slot);
    }
    parsed.swap(filtered);
  }

  if (parsed.empty()) {
    notifyPourResult(false, "empty_command");
    setState(State::ERROR);
    ledError();
    vTaskDelete(nullptr);
  }

  // Log details + ETA
  Serial.println("📋 Recipe details:");
  for (auto &ic : parsed) {
    Serial.printf("   • Slot %2d → %5.2f oz   (prio %d)\n", ic.slot, ic.amount, ic.priority);
  }
  float eta = estimatePourTime(parsed);
  Serial.printf("Estimated total pour time: %.2f s\n", eta);
  Serial.println("---------------------------------");
  {
    StaticJsonDocument<96> doc;
    doc["status"] = "eta";
    doc["eta"]    = eta; // seconds
    String out; serializeJson(doc, out);
    sendData(AWS_RECEIVE_TOPIC, out);
  }

  // Clear NCV faults and ensure OFF baseline
  ncvAll(NCV_CMD_STBY); // clear latches per‑channel
  ncvAll(NCV_CMD_OFF);  // baseline OFF

  // Open outlet (if you have a common outlet valve, assign it a slot and add here)
  // Start pump at full speed
  pumpForward(true);
  pumpSetPWMDuty(255);

  // Sort by priority
  std::sort(parsed.begin(), parsed.end(),
            [](const IngredientCommand &a, const IngredientCommand &b){ return a.priority < b.priority; });

  size_t i = 0;
  while (i < parsed.size()) {
    int pr = parsed[i].priority;
    std::vector<IngredientCommand> group;
    while (i < parsed.size() && parsed[i].priority == pr) { group.push_back(parsed[i]); ++i; }
    Serial.printf("\n— Priority %d (%u items) —\n", pr, (unsigned)group.size());
    dispenseParallelGroup(group);
  }

  // Finish
  pumpStop();
  cleanupDrinkController();

  // Tube cleaning sequence (water then air) with reduced pump duty
  Serial.println("Starting tube cleaning sequence");
  pumpForward(true);
  pumpSetPWMDuty(255); // full for water
  ncvSetSlot(13, true); delay(CLEAN_WATER_MS); ncvSetSlot(13, false);
  pumpSetPWMDuty(160); // gentler for air purge
  ncvSetSlot(14, true); delay(CLEAN_AIR_MS);   ncvSetSlot(14, false);
  pumpStop();
  Serial.println("Tube cleaning sequence complete");

  notifyPourResult(true, nullptr);
  setState(State::IDLE);
  ledIdle();
  Serial.println("✅ Pour complete → IDLE");
  vTaskDelete(nullptr);
}

/* ============================================================================================ */
/*                                       PARSE                                                  */
/* ============================================================================================ */
std::vector<IngredientCommand> parseDrinkCommand(const String &commandStr) {
  std::vector<IngredientCommand> parsed;
  int start = 0;
  while (true) {
    int comma = commandStr.indexOf(',', start);
    String seg = (comma == -1) ? commandStr.substring(start) : commandStr.substring(start, comma);
    seg.trim();
    if (seg.length()) {
      int c1 = seg.indexOf(':');
      int c2 = seg.indexOf(':', c1 + 1);
      if (c1 != -1) {
        IngredientCommand ic{};
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

/* ============================================================================================ */
/*                               DISPENSE (public + helpers)                                     */
/* ============================================================================================ */

void dispenseDrink(std::vector<IngredientCommand> &parsed) {
  if (parsed.empty()) return;
  // Filter invalid slots
  {
    std::vector<IngredientCommand> filtered;
    for (auto &c : parsed) if (isValidIngredientSlot(c.slot)) filtered.push_back(c);
    parsed.swap(filtered);
  }
  if (parsed.empty()) return;

  // Start pump full speed
  pumpForward(true);
  pumpSetPWMDuty(255);

  std::sort(parsed.begin(), parsed.end(),
            [](const IngredientCommand &a, const IngredientCommand &b){ return a.priority < b.priority; });

  size_t i = 0;
  while (i < parsed.size()) {
    int pr = parsed[i].priority;
    std::vector<IngredientCommand> group;
    while (i < parsed.size() && parsed[i].priority == pr) { group.push_back(parsed[i]); ++i; }
    Serial.printf("\n>> Priority %d group <<\n", pr);
    dispenseParallelGroup(group);
  }

  pumpStop();
}

static void dispenseParallelGroup(std::vector<IngredientCommand> &group) {
  std::vector<PourState> pours;
  for (auto &ic : group) {
    if (!isValidIngredientSlot(ic.slot)) continue; // safe
    pours.push_back({ ic.slot, ic.amount, false });
  }
  if (pours.empty()) return;

  const unsigned long stepMs  = 50;  // scheduler tick
  const float         stepSec = 0.05f;

  while (true) {
    int openCnt = 0; float needSum = 0.0f;
    for (auto &p : pours) if (!p.done && p.ouncesLeft > 0.0f) { openCnt++; needSum += p.ouncesLeft; }
    if (openCnt == 0) break;

    // Open the active slots, close others
    for (auto &p : pours) ncvSetSlot(p.slot, (!p.done && p.ouncesLeft > 0.0f));

    // Distribute flow proportionally
    float totalFlow = flowRate(openCnt);
    if (totalFlow <= 0.0f) totalFlow = 0.68f; // safety default for many‑open case
    for (auto &p : pours) {
      if (p.done || p.ouncesLeft <= 0.0f) continue;
      float frac   = p.ouncesLeft / needSum;
      float dispOz = totalFlow * frac * stepSec;
      p.ouncesLeft -= dispOz;
      if (p.ouncesLeft <= 0.0f) { p.ouncesLeft = 0.0f; p.done = true; ncvSetSlot(p.slot, false); }
    }

    delay(stepMs);
  }

  for (auto &p : pours) ncvSetSlot(p.slot, false); // ensure off
}

/* ============================================================================================ */
/*                                     SUPPORT / HELPERS                                        */
/* ============================================================================================ */
static float estimatePourTime(const std::vector<IngredientCommand> &parsed) {
  auto v = parsed;
  std::sort(v.begin(), v.end(), [](const IngredientCommand &a, const IngredientCommand &b){ return a.priority < b.priority; });
  float totalSec = 0.0f; size_t i = 0;
  while (i < v.size()) {
    int pr = v[i].priority; float groupSumOz = 0.0f; int count = 0;
    while (i < v.size() && v[i].priority == pr) { groupSumOz += v[i].amount; count++; i++; }
    float rate = flowRate(count); if (rate > 0.0f) totalSec += groupSumOz / rate;
  }
  return totalSec + 4.0f; // include cleaning & latencies
}

static float flowRate(int n) { // oz/sec (tuned from old system)
  switch (n) {
    case 1: return 0.38f;
    case 2: return 0.54f;
    case 3: return 0.61f;
    case 4: return 0.65f;
    default: return 0.68f; // 5+
  }
}

static uint8_t getIngredientCountFromId() {
#ifdef LIQUORBOT_ID
  if (LIQUORBOT_ID && isdigit(LIQUORBOT_ID[0]) && isdigit(LIQUORBOT_ID[1])) {
    int n = (LIQUORBOT_ID[0]-'0')*10 + (LIQUORBOT_ID[1]-'0');
    if (n < 0) n = 0; if (n > 12) n = 12; // clamp to HW
    return (uint8_t)n;
  }
#endif
  return 12; // default
}

static bool isValidIngredientSlot(int slot) {
  if (slot == 13 || slot == 14) return true;        // water / trash‑air
  uint8_t maxIngr = getIngredientCountFromId();
  return (slot >= 1 && slot <= maxIngr);
}

/* ------------------------------- PUMP (DRV8870) -------------------------------- */
static void pumpSetup() {
  pinMode(PUMP_IN1_PIN, OUTPUT);
  pinMode(PUMP_IN2_PIN, OUTPUT);
  digitalWrite(PUMP_IN1_PIN, LOW);
  digitalWrite(PUMP_IN2_PIN, LOW);
  ledcSetup(PUMP_PWM_CHANNEL, PUMP_PWM_FREQ, PUMP_PWM_RES);
  ledcAttachPin(PUMP_IN1_PIN, PUMP_PWM_CHANNEL); // PWM on IN1 (drive/coast PWM)
  ledcWrite(PUMP_PWM_CHANNEL, 0);
}

static void pumpForward(bool on) {
  if (on) {
    digitalWrite(PUMP_IN2_PIN, LOW);     // drive direction: IN2=0
    ledcWrite(PUMP_PWM_CHANNEL, 255);    // full duty on IN1
  } else {
    pumpStop();
  }
}

static void pumpSetPWMDuty(uint8_t duty) {
  // Ensure direction is forward (IN2=0); speed via IN1 PWM
  digitalWrite(PUMP_IN2_PIN, LOW);
  ledcWrite(PUMP_PWM_CHANNEL, duty);
}

static void pumpStop() {
  // Coast/sleep: both low (device may enter sleep after ~1 ms)
  ledcWrite(PUMP_PWM_CHANNEL, 0);
  digitalWrite(PUMP_IN1_PIN, LOW);
  digitalWrite(PUMP_IN2_PIN, LOW);
}

/* ------------------------------- NCV7240 SPI ----------------------------------- */
static void ncvSetup() {
  // Baseline: all OFF
  ncvWord[0] = 0xFFFF;
  ncvWord[1] = 0xFFFF;
  ncvWriteBoth();
}

static inline void ncvSetPair(uint16_t &word, uint8_t ch, uint8_t cmd) {
  // ch: 1..8, B1..B0 = ch1, ... B15..B14 = ch8
  uint8_t shift = (ch - 1) * 2;
  uint16_t mask = (uint16_t)0b11 << shift;
  word = (word & ~mask) | ((uint16_t)cmd << shift);
}

static void ncvSetSlot(int slot, bool on) {
  if (slot < 1 || slot > 16) return;
  uint8_t chip = (slot <= 8) ? 0 : 1;        // 0=NEAR, 1=FAR
  uint8_t ch   = (slot <= 8) ? slot : (slot - 8); // 1..8
  ncvSetPair(ncvWord[chip], ch, on ? NCV_CMD_ON : NCV_CMD_OFF);
  ncvWriteBoth();
}

static void ncvAll(uint8_t cmd) {
  for (uint8_t ch = 1; ch <= 8; ++ch) ncvSetPair(ncvWord[0], ch, cmd);
  for (uint8_t ch = 1; ch <= 8; ++ch) ncvSetPair(ncvWord[1], ch, cmd);
  ncvWriteBoth();
}

static void ncvWriteBoth() {
  // SPI Mode1, MSB first, up to 5 MHz supported by NCV7240 — we use 1 MHz
  SPISettings settings(1000000, MSBFIRST, SPI_MODE1);
  uint8_t far_hi = (uint8_t)((ncvWord[1] >> 8) & 0xFF);
  uint8_t far_lo = (uint8_t)( ncvWord[1]       & 0xFF);
  uint8_t near_hi= (uint8_t)((ncvWord[0] >> 8) & 0xFF);
  uint8_t near_lo= (uint8_t)( ncvWord[0]       & 0xFF);

  SPI.beginTransaction(settings);
  digitalWrite(SPI_CS, LOW);
  // FAR device first, then NEAR device last (daisy‑chain)
  SPI.transfer(far_hi);  SPI.transfer(far_lo);
  SPI.transfer(near_hi); SPI.transfer(near_lo);
  digitalWrite(SPI_CS, HIGH);
  SPI.endTransaction();
}

/* ============================================================================================ */
/*                                         CLEANUP                                              */
/* ============================================================================================ */
void cleanupDrinkController() {
  // Ensure all NCV outputs are OFF
  ncvAll(NCV_CMD_OFF);
  // Pump stop
  pumpStop();
}
