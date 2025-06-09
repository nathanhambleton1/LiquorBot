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
static const uint16_t DEFAULT_FADE_DURATION = 1000;  // in milliseconds
static const uint8_t DEFAULT_STEPS = 50;

void initLED() {
  strip.begin();
  strip.show(); // Initialize all pixels to 'off'
  currentColor = strip.Color(0, 0, 0);
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
    r += stepR;
    g += stepG;
    b += stepB;
    setLEDColor(strip.Color((uint8_t)r, (uint8_t)g, (uint8_t)b));
    delay(stepDelay);
  }
  // Ensure the final color is set precisely
  setLEDColor(targetColor);
}

void fadeToRed() {
  fadeToColor(strip.Color(255, 0, 0));
}

void fadeToGreen() {
  fadeToColor(strip.Color(0, 255, 0));
}

void fadeToWhite() {
  fadeToColor(strip.Color(255, 255, 255));
}

void ledOn() {
  // Fade from black to white
  fadeToColor(strip.Color(255, 255, 255));
}

void ledOff() {
  // Fade from current color to black
  fadeToColor(strip.Color(0, 0, 0));
}

void ledPouring() {
  fadeToGreen();
}

void ledError() {
  fadeToRed();
}

void ledIdle() {
  fadeToWhite();
}