/*
 * -----------------------------------------------------------------------------
 *  Project: Liquor Bot
 *  File: wifi_setup.h
 *  Description: Declares functions for managing Wi-Fi connectivity, including 
 *               storing credentials and establishing a connection.
 * 
 *  Author: Nathan Hambleton
 * -----------------------------------------------------------------------------
 */

#ifndef WIFI_SETUP_H
#define WIFI_SETUP_H

#include <string>
#include <WiFi.h>

// Global variables to hold Wi-Fi credentials
extern std::string ssid;
extern std::string password;

// Function declarations
void initWiFiStorage();
void setWiFiCredentials(const std::string &newSSID, const std::string &newPassword);
bool attemptSavedWiFiConnection();
void clearWiFiCredentials();
bool connectToWiFi();
void disconnectFromWiFi();

#endif // WIFI_SETUP_H
