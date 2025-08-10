/*
 * -----------------------------------------------------------------------------
 *  Project: Liquor Bot
 *  File: led_control.h
 *  Description: Declares simplified functions for controlling a WS2812 LED ring
 *               with smooth fading transitions. Use functions like fadeToRed(),
 *               fadeToGreen(), fadeToWhite(), ledOn(), and ledOff() without
 *               additional parameters.
 * 
 *  Author: Nathan Hambleton
 * -----------------------------------------------------------------------------
 */

 #ifndef LED_CONTROL_H
 #define LED_CONTROL_H
 
 #include <Arduino.h>
 
 // 24-pixel RGB ring
 #define LED_COUNT 24
 
 // Initialize the LED ring (call once in setup)
 void initLED();
 
 // Immediately set the LED color (24-bit color value)
 void setLEDColor(uint32_t color);
 
 // Fade from the current color to the specified target color using default settings
 void fadeToColor(uint32_t targetColor);
 
 // Convenience functions for preset fades
 void fadeToRed();
 void fadeToGreen();
 void fadeToWhite();
 
 // Turn on the LED with a fade from black to white
 void ledOn();
 
 // Turn off the LED with a fade from the current color to black
 void ledOff();

 // State-based LED feedback helpers
 void ledPouring();   // Flash + fade to green for POURING state
 void ledError();     // Fade to red for ERROR state
 void ledIdle();      // Fade to white for IDLE state (always-on white idle)
 
 #endif // LED_CONTROL_H
