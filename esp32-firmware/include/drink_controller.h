/*
 * -----------------------------------------------------------------------------
 *  Project: Liquor Bot
 *  File: drink_controller.h  (updated)
 *  Description: Structures & API for non‑blocking drink dispensing.
 * -----------------------------------------------------------------------------
 */

#ifndef DRINK_CONTROLLER_H
#define DRINK_CONTROLLER_H

#include <Arduino.h>
#include <vector>
#include <String>

struct IngredientCommand {
    int   slot;     // 1‑16 (matches solenoid)
    float amount;   // ounces
    int   priority; // lower = earlier group
};

// ---------- Init ----------
void initDrinkController();

// ---------- Parsing ----------
std::vector<IngredientCommand> parseDrinkCommand(const String &commandStr);

// ---------- Execution (blocking – internal use) ----------
void dispenseDrink(std::vector<IngredientCommand> &parsedCommand);

// ---------- NEW: kick off non‑blocking pour ----------
void startPourTask(const String &commandStr);

// ---------- Cleanup ----------
void cleanupDrinkController();

// ---------- Lightweight control helpers (for maintenance) ----------
// Directly control a daisy‑chained NCV7240 slot (1..16). True=open (ON), False=closed (OFF).
void dcSetSpiSlot(int slot, bool on);

// Set outlet solenoids 1..4 (GPIO controlled). True=ON, False=OFF.
void dcOutletSetState(bool s1, bool s2, bool s3, bool s4);
void dcOutletAllOff();

// Pump controls (DRV8870). Forward=drive with IN2=LOW and PWM on IN1.
void dcPumpForward(bool on);
void dcPumpSetDuty(uint8_t duty);
void dcPumpStop();

// Return the number of ingredient slots available based on LIQUORBOT_ID (clamped 0..12).
uint8_t dcGetIngredientCount();

#endif // DRINK_CONTROLLER_H
