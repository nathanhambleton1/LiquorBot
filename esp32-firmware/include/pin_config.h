/*
 * -----------------------------------------------------------------------------
 *  Project: Liquor Bot
 *  File: pin_config.h
 *  Description: Defines hardware pin configurations for SPI communication 
 *               and other necessary connections.
 * 
 *  Author: Nathan Hambleton
 * -----------------------------------------------------------------------------
 */

#ifndef PIN_CONFIG_H
#define PIN_CONFIG_H

#include <Arduino.h>

// Pin definitions for SPI
#define SPI_MOSI  23
#define SPI_MISO  19
#define SPI_SCK   18
#define SPI_CS    5

// Pump pin assignments
#define PUMP1_PIN 17
#define PUMP2_PIN 2

// LED Pin assignemnt
#define LED_PIN 4

#endif // PIN_CONFIG_H
