/*
 * -----------------------------------------------------------------------------
 *  Project: Liquor Bot
 *  File: drink_controller.cpp
 *  Description: Manages the control logic for dispensing drinks using solenoids.
 *               This module handles SPI communication with NCV7240 chips, 
 *               processes drink commands, and coordinates parallel dispensing 
 *               with priority-based scheduling.
 * 
 *  Author: Nathan Hambleton
 * -----------------------------------------------------------------------------
 */

#include <Arduino.h>
#include <SPI.h>
#include "drink_controller.h"
#include "pin_config.h"

//Forward declarations
void cleanupDrinkController();

// We keep a 16-bit state for the two daisy-chained NCV7240
// bit 0 => solenoid #0, bit 1 => #1, ..., bit 15 => #15
static uint16_t ncvState = 0x0000;

// --------------------- NCV7240 SPI WRITE ---------------------
/*
   Writes the 16-bit 'state' to two daisy-chained NCV7240 chips.
   Each NCV7240 has 8 outputs, so 16 bits total for 2 chips.
   We'll shift out MSB first or LSB first depending on how your hardware is wired.
   The NCV7240 typically latches data on rising edge of CS.
*/
static void writeNCV7240(uint16_t state) {
    // Example: We send 2 bytes. Check your NCV7240 datasheet for bit order.
    // We'll assume MSB first for demonstration.

    uint8_t highByte = (state >> 8) & 0xFF;   // top 8 bits
    uint8_t lowByte  = state & 0xFF;         // low 8 bits

    digitalWrite(SPI_CS, LOW);
    // SPI transfer 2 bytes
    SPI.transfer(highByte);
    SPI.transfer(lowByte);
    digitalWrite(SPI_CS, HIGH);
}

// --------------------- INIT ---------------------
void initDrinkController() {
    // Initialize SPI
    SPI.begin(SPI_SCK, SPI_MISO, SPI_MOSI, SPI_CS);
    pinMode(SPI_CS, OUTPUT);
    digitalWrite(SPI_CS, HIGH); // CS idle high

    // Set initial all OFF
    ncvState = 0x0000;
    writeNCV7240(ncvState);
    Serial.println("NCV7240 SPI initialized, all outputs OFF.");

    // Initialize Pumps GPIO
    pinMode(PUMP1_PIN, OUTPUT);
    pinMode(PUMP2_PIN, OUTPUT);
    digitalWrite(PUMP1_PIN, LOW); // Ensure pumps are off initially
    digitalWrite(PUMP2_PIN, LOW);
}

// --------------------- HELPER: SET SOLENOID ---------------------
/*
   setSolenoid(slot, on):
   slot: 1..16
   on: true => set bit, false => clear bit
*/
static void setSolenoid(int slot, bool on) {
    // Convert user slot (1..16) to bit index (0..15)
    int bitIndex = slot - 1;
    if (bitIndex < 0 || bitIndex >= 16) {
        Serial.println("Invalid slot " + String(slot));
        return;
    }

    if (on) {
        ncvState |= (1 << bitIndex);
    } else {
        ncvState &= ~(1 << bitIndex);
    }
    writeNCV7240(ncvState);
}

// --------------------- FLOW RATE EXAMPLE ---------------------
// Example function that returns total manifold flow (oz/sec) 
// depending on how many are open
static float flowRate(int numOpen) {
    switch (numOpen) {
        case 1: return 1.0f;
        case 2: return 1.5f;
        case 3: return 1.7f;
        case 4: return 1.8f;
        default: return 0.0f;
    }
}

// --------------------- PARSE LOGIC ---------------------
std::vector<IngredientCommand> parseDrinkCommand(const String &commandStr) {
    std::vector<IngredientCommand> parsedCommand;
    int start = 0;
    while (true) {
        int commaIndex = commandStr.indexOf(',', start);
        String segment;
        if (commaIndex == -1) {
            segment = commandStr.substring(start);
        } else {
            segment = commandStr.substring(start, commaIndex);
        }
        segment.trim();

        if (segment.length() > 0) {
            int firstColon = segment.indexOf(':');
            int secondColon = segment.indexOf(':', firstColon + 1);

            if (firstColon != -1) {
                IngredientCommand cmd;
                
                String slotStr = segment.substring(0, firstColon);
                slotStr.trim();
                cmd.slot = slotStr.toInt();

                if (secondColon != -1) {
                    String amountStr = segment.substring(firstColon + 1, secondColon);
                    amountStr.trim();
                    cmd.amount = amountStr.toFloat();

                    String priorityStr = segment.substring(secondColon + 1);
                    priorityStr.trim();
                    cmd.priority = priorityStr.toInt();
                } else {
                    String amountStr = segment.substring(firstColon + 1);
                    amountStr.trim();
                    cmd.amount = amountStr.toFloat();
                    cmd.priority = 99;
                }

                parsedCommand.push_back(cmd);
            }
        }

        if (commaIndex == -1) break;
        start = commaIndex + 1;
    }
    return parsedCommand;
}

// --------------------- TIME-SLICING PARALLEL LOGIC ---------------------
struct PourState {
    int slot;
    float ouncesNeeded;
    bool done;
};

static void dispenseParallelGroup(std::vector<IngredientCommand> &group) {
    std::vector<PourState> pours;
    for (auto &cmd : group) {
        PourState st;
        st.slot = cmd.slot;
        st.ouncesNeeded = cmd.amount;
        st.done = false;
        if (st.slot < 1 || st.slot > 16) {
            Serial.println("Unknown slot: " + String(cmd.slot));
            st.done = true;
        }
        pours.push_back(st);
    }

    Serial.println("=== Starting parallel group with " + String(pours.size()) + " slots ===");

    const unsigned long stepMs = 50; 
    const float stepSec = 0.05f;  
    bool groupFinished = false;

    while (!groupFinished) {
        // 1) Count how many are still open
        int openCount = 0;
        for (auto &p : pours) {
            if (!p.done && p.ouncesNeeded > 0.0f) {
                openCount++;
            }
        }
        if (openCount == 0) {
            groupFinished = true;
            break;
        }

        // 2) Turn ON all still-active slots, OFF others
        for (auto &p : pours) {
            if (!p.done && p.ouncesNeeded > 0.0f) {
                setSolenoid(p.slot, true); 
            } else {
                setSolenoid(p.slot, false); 
            }
        }

        // 3) totalFlow( openCount )
        float totalFlow = flowRate(openCount);
        float sumNeeded = 0.0f;
        for (auto &p : pours) {
            if (!p.done && p.ouncesNeeded > 0.0f) {
                sumNeeded += p.ouncesNeeded;
            }
        }
        if (sumNeeded < 0.0001f) {
            groupFinished = true;
            break;
        }

        // 4) distribute flow proportionally
        for (auto &p : pours) {
            if (!p.done && p.ouncesNeeded > 0.0f) {
                float fraction = p.ouncesNeeded / sumNeeded; 
                float slotFlow = totalFlow * fraction; 
                float disp = slotFlow * stepSec; 
                p.ouncesNeeded -= disp;
                if (p.ouncesNeeded <= 0.0f) {
                    p.ouncesNeeded = 0.0f;
                    p.done = true;
                }
            }
        }

        delay(stepMs);
    }

    // Turn all off at the end
    for (auto &p : pours) {
        setSolenoid(p.slot, false); 
    }

    Serial.println("=== Parallel group done ===");
}

// --------------------- MAIN DISPENSE FUNCTION ---------------------
void dispenseDrink(std::vector<IngredientCommand> &parsedCommand) {
    // Turn on Pump1 to start pouring
    digitalWrite(PUMP1_PIN, HIGH);
    Serial.println("Pump1 ON (FOWARD).");

    // Sort ascending by priority
    std::sort(parsedCommand.begin(), parsedCommand.end(),
              [](const IngredientCommand &a, const IngredientCommand &b){
                  return a.priority < b.priority;
              });

    int i = 0;
    while (i < (int)parsedCommand.size()) {
        int currentPriority = parsedCommand[i].priority;
        std::vector<IngredientCommand> group;
        while (i < (int)parsedCommand.size() &&
               parsedCommand[i].priority == currentPriority) {
            group.push_back(parsedCommand[i]);
            i++;
        }
        Serial.println("\n>> Priority " + String(currentPriority) + " group <<");
        dispenseParallelGroup(group);
    }

    // Turn off Pump1 once done
    digitalWrite(PUMP1_PIN, LOW);
    Serial.println("Pump1 OFF (FOWARD).");

    // Call cleanup function
    cleanupDrinkController();
    Serial.println("All priority groups complete. Drink done!");
}

// --------------------- CLEANUP (EMPTY) ---------------------
void cleanupDrinkController() {
    // Currently empty, user can implement final tasks here if needed
}