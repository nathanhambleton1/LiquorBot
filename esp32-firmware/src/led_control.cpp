/*
 * -----------------------------------------------------------------------------
 *  Project: Liquor Bot
 *  File: led_control.cpp
 *  Description: Implements functions for controlling a WS2812 LED ring with 
 *               smooth color transitions using the Adafruit NeoPixel library.
 *               Provides functions to fade the LED from its current color to a 
 *               target color, as well as preset transitions to red, green, and white.
 * 
 *  Author: Nathan Hambleton
 * -----------------------------------------------------------------------------
 */

#include "led_control.h"
#include <Adafruit_NeoPixel.h>
#include "pin_config.h"  // Ensure this file includes LED pin configuration

// Create an instance of the NeoPixel strip
Adafruit_NeoPixel strip = Adafruit_NeoPixel(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800);

// Store the current LED color (initialized to off/black)
static uint32_t currentColor = 0;

// Default fade configuration (adjust these values as needed)
static const uint16_t DEFAULT_FADE_DURATION = 800;   // in milliseconds (slightly faster)
static const uint8_t DEFAULT_STEPS = 50;

void initLED() {
  strip.begin();
  strip.show(); // Initialize all pixels to 'off'
  currentColor = strip.Color(0, 0, 0);
  // Immediately fade to idle (white) on startup
  fadeToWhite();
}

void setLEDColor(uint32_t color) {
  currentColor = color;
  for (uint16_t i = 0; i < LED_COUNT; i++) {
    strip.setPixelColor(i, color);
  }
  strip.show();
}

void fadeToColor(uint32_t targetColor) {
  uint16_t stepDelay = DEFAULT_FADE_DURATION / DEFAULT_STEPS;
  // Extract current RGB components
  uint8_t currR = (currentColor >> 16) & 0xFF;
  uint8_t currG = (currentColor >> 8) & 0xFF;
  uint8_t currB = currentColor & 0xFF;
  // Extract target RGB components
  uint8_t targetR = (targetColor >> 16) & 0xFF;
  uint8_t targetG = (targetColor >> 8) & 0xFF;
  uint8_t targetB = targetColor & 0xFF;
  // Calculate per-step increments
  float stepR = (targetR - currR) / (float) DEFAULT_STEPS;
  float stepG = (targetG - currG) / (float) DEFAULT_STEPS;
  float stepB = (targetB - currB) / (float) DEFAULT_STEPS;
  float r = currR, g = currG, b = currB;
  for (uint8_t i = 0; i < DEFAULT_STEPS; i++) {
    r += stepR; g += stepG; b += stepB;
    setLEDColor(strip.Color((uint8_t)r, (uint8_t)g, (uint8_t)b));
    delay(stepDelay);
  }
  // Ensure the final color is set precisely
  setLEDColor(targetColor);
}

void fadeToColor(uint32_t targetColor, uint16_t durationMs, uint8_t steps) {
  if (steps == 0) { setLEDColor(targetColor); return; }
  uint16_t stepDelay = durationMs / steps;
  uint8_t currR = (currentColor >> 16) & 0xFF;
  uint8_t currG = (currentColor >> 8) & 0xFF;
  uint8_t currB = currentColor & 0xFF;
  uint8_t targetR = (targetColor >> 16) & 0xFF;
  uint8_t targetG = (targetColor >> 8) & 0xFF;
  uint8_t targetB = targetColor & 0xFF;
  float stepR = (targetR - currR) / (float) steps;
  float stepG = (targetG - currG) / (float) steps;
  float stepB = (targetB - currB) / (float) steps;
  float r = currR, g = currG, b = currB;
  for (uint8_t i = 0; i < steps; i++) {
    r += stepR; g += stepG; b += stepB;
    setLEDColor(strip.Color((uint8_t)r, (uint8_t)g, (uint8_t)b));
    delay(stepDelay);
  }
  setLEDColor(targetColor);
}

void fadeToRed()   { fadeToColor(strip.Color(255, 0, 0), 300, 60); }
void fadeToGreen() { fadeToColor(strip.Color(0, 255, 0), 300, 60); }
void fadeToWhite() { fadeToColor(strip.Color(255, 255, 255), 300, 60); }

void ledOn()  { fadeToWhite(); }
void ledOff() { fadeToColor(strip.Color(0, 0, 0)); }

// Helper: brief flash effect (white -> off -> target) to add attention
static void flashTo(uint32_t targetColor) {
  // quick white flash
  setLEDColor(strip.Color(255,255,255)); delay(120);
  setLEDColor(strip.Color(0,0,0));       delay(80);
  fadeToColor(targetColor);
}

// Helper: flash between two colors for a given duration (blocking)
static void flashBetween(uint32_t c1, uint32_t c2, uint16_t durationMs) {
  // Smooth alternation using short fades
  const uint16_t beat = 200;      // total time per color
  const uint8_t  steps = 20;      // smoothness per transition
  unsigned long start = millis();
  bool toC2 = true;
  while ((millis() - start) < durationMs) {
    if (toC2) {
      fadeToColor(c2, beat, steps);
    } else {
      fadeToColor(c1, beat, steps);
    }
    toC2 = !toC2;
  }
}

void ledError() {
  fadeToRed();
}

void ledIdle() {
  // Return to steady white over a couple seconds
  fadeToWhite();
}

void ledSuccess() {
  // From red, fade to green, smooth flash G/white ~1.2s, then fade back to white
  uint32_t green = strip.Color(0, 255, 0);
  uint32_t white = strip.Color(255, 255, 255);
  fadeToColor(green, 400, 25);     // quick fade to green
  flashBetween(green, white, 1200);
  fadeToColor(white, 600, 30);     // gentle fade back to white
}

void ledFlashRedQuick() {
  // Brief attention-grabbing red blink without long blocking
  uint32_t red = strip.Color(255, 0, 0);
  uint32_t off = strip.Color(0, 0, 0);
  // Two short pulses ~400ms total
  setLEDColor(red); delay(120);
  setLEDColor(off); delay(80);
  setLEDColor(red); delay(120);
  // leave it red to indicate pause/error state
}