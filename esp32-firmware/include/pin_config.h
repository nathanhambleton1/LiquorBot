/*
 * -----------------------------------------------------------------------------
 *  Project: Liquor Bot
 *  File: pin_config.h
 *  Description: Central hardware pin & timing configuration used by drink_controller.
 *               (Values here override internal fallbacks in drink_controller.cpp.)
 *
 *  NOTE: Update these definitions to match your PCB / wiring. All logic in
 *        drink_controller.cpp assumes these names.
 *
 *  Author: Nathan Hambleton
 * -----------------------------------------------------------------------------
 */
#ifndef PIN_CONFIG_H
#define PIN_CONFIG_H

#include <Arduino.h>

/* ----------------------------- SPI (NCV7240 chain) ----------------------------- */
// SPI host pins (Mode 1, MSB first). Adjust for your board.
#define SPI_MOSI        23
#define SPI_MISO        19
#define SPI_SCK         18
#define SPI_CS          5   // Chip Select for the (daisy‑chained) NCV7240 drivers

/* ----------------------------- Pump (DRV8870) ---------------------------------- */
// H‑bridge control pins (IN1 PWM, IN2 static LOW for forward drive)
#define PUMP_IN1_PIN    16
#define PUMP_IN2_PIN    17

/* ----------------------------- Optional NCV7240 control ------------------------ */
// If your hardware exposes EN or LHI (latched fault) control lines, set real GPIOs.
// Use -1 to indicate the line is not connected / managed in software.
#define NCV_EN_PIN      -1
#define NCV_LHI_PIN     -1

/* ----------------------------- Pump PWM (LEDC) --------------------------------- */
#define PUMP_PWM_CHANNEL 0      // LEDC channel index
#define PUMP_PWM_FREQ    1000   // Hz
#define PUMP_PWM_RES     8      // bits (0..255 duty)

// Pump duty presets for water flush vs. air purge (can be tuned per hardware)
#define PUMP_WATER_DUTY  255    // full speed for water
#define PUMP_AIR_DUTY    160    // gentler for air purge/back-blow

/* ----------------------------- Cleaning Durations ------------------------------ */
// Slot 13 = WATER flush, Slot 14 = AIR (trash/purge) per drink_controller logic
#define CLEAN_WATER_MS     2000   // ms pump ON from water valve (SPI slot 13) open to output spout
#define CLEAN_AIR_TOP_MS   1500   // ms pump ON to push air out of top/spout (outputs 1/4 path)
#define CLEAN_TRASH_MS     2500   // ms pump ON + trash/air valve (SPI slot 14) open to dump

/* ----------------------------- Quick Clean Duration -------------------------- */
// Quick clean: water-only forward flush duration (outputs 1 & 3 path, slot 13 open, 1..12 closed, 14 closed)
#define QUICK_CLEAN_MS     5000   // ms (tune as needed)

/* ----------------------------- Empty System Duration ------------------------- */
// Time to run the backflow/empty routine (open slots 1..12, outputs 2&4 path, slots 13&14 open)
#define EMPTY_SYSTEM_MS     4000   // ms

/* ----------------------------- Deep Clean Duration --------------------------- */
// Time to run deep clean (outputs 1&3 path, open 1..12 + water feed; pump forward)
#define DEEP_CLEAN_MS        10000  // ms

/* ----------------------------- Outlet/Top Solenoids (GPIO) --------------------- */
// Four additional non-SPI solenoids near the outlet controlled directly via GPIO.
// Index → GPIO mapping:
//  1 → 25,  2 → 26,  3 → 27,  4 → 14
// These default to OFF at boot and are opened/closed by drink_controller.
#define OUT_SOL1_PIN     25
#define OUT_SOL2_PIN     26
#define OUT_SOL3_PIN     27
#define OUT_SOL4_PIN     14

/* ----------------------------- LED (status) ------------------------------------ */
#define LED_PIN          4   // NeoPixel data pin (24 LED ring)

/* ----------------------------- Pressure Pad (FSR) ---------------------------- */
// Choose an ADC1-capable GPIO (e.g., 32, 33, 34, 35, 36, 39). Do not use ADC2 when WiFi is used.
// Default to GPIO 34 (input-only). Adjust to your wiring.
#define PRESSURE_ADC_PIN     32
// Optional attenuation (one of ADC_0db, ADC_2_5db, ADC_6db, ADC_11db). Comment out to skip.
//#define PRESSURE_ADC_ATTEN   ADC_11db

// Presence thresholds (expressed as fraction over baseline). Can be tuned at runtime too.
// Lower these if lighter cups aren’t detected; raise to avoid false positives.
// With typical wiring, a cup lowers ADC.
#define PRESSURE_ON_PCT      0.05f  // 5% in the presence direction => present (more sensitive)
#define PRESSURE_OFF_PCT     0.02f  // 2% to clear (keeps ~40% hysteresis band)
#define PRESSURE_DEBOUNCE_MS 120

#endif // PIN_CONFIG_H
