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

// Backward compatibility (legacy names used elsewhere)
#define PUMP1_PIN       PUMP_IN1_PIN
#define PUMP2_PIN       PUMP_IN2_PIN

/* ----------------------------- Optional NCV7240 control ------------------------ */
// If your hardware exposes EN or LHI (latched fault) control lines, set real GPIOs.
// Use -1 to indicate the line is not connected / managed in software.
#define NCV_EN_PIN      -1
#define NCV_LHI_PIN     -1

/* ----------------------------- Pump PWM (LEDC) --------------------------------- */
#define PUMP_PWM_CHANNEL 0      // LEDC channel index
#define PUMP_PWM_FREQ    1000   // Hz
#define PUMP_PWM_RES     8      // bits (0..255 duty)

/* ----------------------------- Cleaning Durations ------------------------------ */
// Slot 13 = WATER flush, Slot 14 = AIR (trash/purge) per drink_controller logic
#define CLEAN_WATER_MS   2000   // ms pump ON + water valve open
#define CLEAN_AIR_MS     3000   // ms pump ON + air (trash) valve open

/* ----------------------------- LED (status) ------------------------------------ */
#define LED_PIN          4   // NeoPixel data pin (24 LED ring)

#endif // PIN_CONFIG_H
