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

#endif // DRINK_CONTROLLER_H
