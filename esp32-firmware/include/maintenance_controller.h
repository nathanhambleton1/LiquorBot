/*  maintenance_controller.h
 *  Declares maintenance task functions for system cleaning, priming, etc.
 *  Integrates with state_manager and aws_manager for robust state and cloud communication.
 *  Author: Nathan Hambleton – 2025
 * -------------------------------------------------------------------------- */

#ifndef MAINTENANCE_CONTROLLER_H
#define MAINTENANCE_CONTROLLER_H

#include <Arduino.h>

// Start the READY_SYSTEM (prime tubes) maintenance task
void startReadySystemTask();

// Start the EMPTY_SYSTEM maintenance task
void startEmptySystemTask();

// Quick clean: short automatic rinse to spout; publishes OK when finished
void startQuickCleanTask();

// Custom clean controls for a single ingredient line (1-based)
// phase: 1 = soap/cleaner, 2 = rinse
void customCleanStart(uint8_t ingredientSlot, uint8_t phase);
void customCleanStop();
void customCleanResume(uint8_t ingredientSlot, uint8_t phase);

// Deep clean, interactive per-line control + final flush
void deepCleanStartLine(uint8_t ingredientSlot);
void deepCleanStopLine();
void deepCleanFinalFlush();


// Start emptying a single ingredient slot (1-based)
void startEmptyIngredientTask(uint8_t ingredientSlot);

// Stop emptying a single ingredient (force cleanup)
void stopEmptyIngredientTask();

#endif // MAINTENANCE_CONTROLLER_H
