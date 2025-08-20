/*
 * -----------------------------------------------------------------------------
 *  Project: Liquor Bot
 *  File: pressure_pad.h
 *  Description: Thin-film pressure sensor (FSR) reader with boot-time baseline
 *               calibration and cup presence detection via % over baseline.
 *
 *  Wiring (typical voltage divider):
 *    3V3 --[Rfixed]--+-- to ADC (PRESSURE_ADC_PIN)
 *                     |
 *                   [FSR]
 *                     |
 *                    GND
 *    Choose Rfixed ~10k–47k to get good range with your FSR. Higher R increases
 *    sensitivity to small forces. Ensure ADC pin supports analog input (ADC1).
 * -----------------------------------------------------------------------------
 */

#ifndef PRESSURE_PAD_H
#define PRESSURE_PAD_H

#include <Arduino.h>

// Logging control (default off). Define PRESSURE_PAD_LOG=1 before including
// this header to enable detailed pressure pad logs.
#ifndef PRESSURE_PAD_LOG
#define PRESSURE_PAD_LOG 0
#endif

// Initialize ADC + start background sampling & auto-cal.
void pressurePadInit();

// Re-calibrate baseline (assumes the pad is empty). Blocks for durationMs.
void pressurePadCalibrate(uint16_t durationMs = 1500);

// Presence detection API (uses hysteresis around threshold percent)
bool isCupPresent();
void setPresenceThresholdPercent(float pctOn /*0..1*/);
void setPresenceHysteresisPercent(float pctOff /*0..1*/); // off threshold relative to baseline
void setPresenceDebounceMs(uint16_t ms);
float getPresenceThresholdPercent();
float getPresenceHysteresisPercent();
uint16_t getPresenceDebounceMs();

// Polarity and baseline controls
// By default, placing a cup lowers the ADC reading (FSR to GND wiring).
// If your wiring causes ADC to rise with pressure, set lowers=false.
void setPadPolarityLowers(bool lowers);
bool getPadPolarityLowers();

// When locked (default), baseline will NOT auto-adapt while running.
// Unlock only if you want very slow drift correction when the pad is empty.
void setBaselineLock(bool locked);
bool getBaselineLock();

// Telemetry
uint16_t pressurePadRaw();        // last raw ADC reading (0..4095)
float    pressurePadFiltered();   // EMA filtered reading
float    pressurePadBaseline();   // current baseline (slowly tracks when no cup)
float    pressurePadPctOver();    // One-sided delta in the configured cup-press direction, >= 0

#endif // PRESSURE_PAD_H
