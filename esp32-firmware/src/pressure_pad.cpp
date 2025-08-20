#include <Arduino.h>
#include <math.h>
#include "pressure_pad.h"
#include "pin_config.h"

// Implementation details
static volatile uint16_t s_raw = 0;     // last raw
static volatile float    s_filt = 0.0f; // EMA filtered
static volatile float    s_base = 0.0f; // baseline (empty pad), EMA slow
static volatile bool     s_present = false;
static volatile unsigned long s_lastEdgeMs = 0;
static volatile bool     s_polarityLowers = true; // true: cup lowers ADC; false: cup raises ADC
static volatile bool     s_baselineLocked = true; // true: baseline does not adapt during session

// Tunables (can be overridden via setters)
static float    kEmaAlpha = 0.2f;           // filter for raw -> filtered
static float    kBaseAlpha = 0.01f;         // slow baseline tracker when not present (used only if unlocked)
static float    kOnThresholdPct  =
#ifdef PRESSURE_ON_PCT
    PRESSURE_ON_PCT
#else
    0.20f
#endif
;   // 20% above baseline => present
static float    kOffThresholdPct =
#ifdef PRESSURE_OFF_PCT
    PRESSURE_OFF_PCT
#else
    0.12f
#endif
;   // 12% above baseline => absent
static uint16_t kDebounceMs      =
#ifdef PRESSURE_DEBOUNCE_MS
    PRESSURE_DEBOUNCE_MS
#else
    150
#endif
;     // debounce for state transitions
static uint16_t kSampleMs        = 20;      // sampling period (~50 Hz)

static TaskHandle_t s_task = nullptr;

static uint16_t readADC() {
#if defined(PRESSURE_ADC_PIN)
    int v = analogRead(PRESSURE_ADC_PIN); // 12-bit on ESP32 (0..4095)
    if (v < 0) v = 0; if (v > 4095) v = 4095;
    return (uint16_t)v;
#else
    return 0;
#endif
}

static void samplerTask(void *arg) {
#if defined(PRESSURE_ADC_PIN)
    // ADC setup: use ADC1 pins only to avoid WiFi interference.
    analogReadResolution(12);
    // Optional attenuation
    #ifdef PRESSURE_ADC_ATTEN
    analogSetPinAttenuation(PRESSURE_ADC_PIN, PRESSURE_ADC_ATTEN);
    #endif

    // Take a short burst to seed baseline
    const int seedN = 25;
    uint32_t sum = 0;
    for (int i = 0; i < seedN; ++i) { sum += readADC(); vTaskDelay(pdMS_TO_TICKS(5)); }
    s_raw = sum / seedN;
    s_filt = (float)s_raw;
    s_base = s_filt; // start equal
#endif

    while (true) {
#if defined(PRESSURE_ADC_PIN)
        uint16_t r = readADC();
        s_raw = r;
        // EMA filter
        s_filt = (1.0f - kEmaAlpha) * s_filt + kEmaAlpha * (float)r;

        // Presence decision with hysteresis + debounce (one-sided by polarity)
        float pct = 0.0f; // magnitude in the configured direction
        if (s_base > 1.0f) {
            float delta = s_filt - s_base;
            // We look only in the chosen direction to avoid inverted toggles
            float dir = s_polarityLowers ? -delta : delta; // positive when in presence direction
            if (dir > 0.0f) pct = dir / s_base; else pct = 0.0f;
        }
        bool prev = s_present;
        bool next = s_present;
        unsigned long now = millis();
        if (!s_present) {
            if (pct >= kOnThresholdPct) {
                if (now - s_lastEdgeMs >= kDebounceMs) { next = true; s_lastEdgeMs = now; }
            } else {
                // slowly update baseline when empty (only if unlocked)
                if (!s_baselineLocked) {
                    s_base = (1.0f - kBaseAlpha) * s_base + kBaseAlpha * s_filt;
                }
            }
        } else {
            if (pct <= kOffThresholdPct) {
                if (now - s_lastEdgeMs >= kDebounceMs) { next = false; s_lastEdgeMs = now; }
            }
        }
    // Log removed
        s_present = next;
#endif
        vTaskDelay(pdMS_TO_TICKS(kSampleMs));
    }
}

void pressurePadInit() {
#if defined(PRESSURE_ADC_PIN)
    pinMode(PRESSURE_ADC_PIN, INPUT);
#endif
    if (!s_task) {
        xTaskCreatePinnedToCore(samplerTask, "PadSampler", 3072, nullptr, 1, &s_task, 1);
    }
}

void pressurePadCalibrate(uint16_t durationMs) {
    // Assume empty pad. Average samples over window to set baseline.
    uint32_t sum = 0; uint16_t n = 0;
    unsigned long endAt = millis() + durationMs;
    while ((long)(endAt - millis()) > 0) {
        sum += pressurePadRaw(); n++;
        delay(10);
    }
    if (n > 0) {
        float b = (float)(sum / n);
        s_base = b; // reset baseline
        s_filt = b; // re-center
        s_present = false;
    s_lastEdgeMs = millis();
    }
}

bool isCupPresent() { return s_present; }

void setPresenceThresholdPercent(float pctOn) { kOnThresholdPct = constrain(pctOn, 0.0f, 1.0f); }
void setPresenceHysteresisPercent(float pctOff) { kOffThresholdPct = constrain(pctOff, 0.0f, 1.0f); }
void setPresenceDebounceMs(uint16_t ms) { kDebounceMs = ms; }
float getPresenceThresholdPercent() { return kOnThresholdPct; }
float getPresenceHysteresisPercent() { return kOffThresholdPct; }
uint16_t getPresenceDebounceMs() { return kDebounceMs; }

void setPadPolarityLowers(bool lowers) { s_polarityLowers = lowers; }
bool getPadPolarityLowers() { return s_polarityLowers; }
void setBaselineLock(bool locked) { s_baselineLocked = locked; }
bool getBaselineLock() { return s_baselineLocked; }

uint16_t pressurePadRaw() { return s_raw; }
float pressurePadFiltered() { return s_filt; }
float pressurePadBaseline() { return s_base; }
float pressurePadPctOver() {
    if (s_base <= 1.0f) return 0.0f;
    float delta = s_filt - s_base;
    float dir = s_polarityLowers ? -delta : delta;
    if (dir <= 0.0f) return 0.0f;
    return dir / s_base;
}
