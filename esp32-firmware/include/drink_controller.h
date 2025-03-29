/*
 * -----------------------------------------------------------------------------
 *  Project: Liquor Bot
 *  File: drink_controller.h
 *  Description: Defines structures and functions for controlling solenoids 
 *               and pumps to dispense drinks. Includes parsing logic for 
 *               drink commands and execution of dispensing sequences.
 * 
 *  Author: Nathan Hambleton
 * -----------------------------------------------------------------------------
 */

#ifndef DRINK_CONTROLLER_H
#define DRINK_CONTROLLER_H

#include <Arduino.h>
#include <vector>
#include <String>

struct IngredientCommand {
    int slot;       // e.g. Ingredient 1, 2, 3, ...
    float amount;   // e.g. 2.5 (oz)
    int priority;   // e.g. 1, 2, 3, ... (order of dispensing)
};

// Initializes pins for solenoids and pumps
void initDrinkController();

// Parses the incoming command string, e.g. "Pump1:30,Pump2:15,Pump3:10"
std::vector<IngredientCommand> parseDrinkCommand(const String &commandStr);

// Executes the sequence of pours
void dispenseDrink(std::vector<IngredientCommand> &parsedCommand);

// Cleanup function
void cleanupDrinkController();


#endif
