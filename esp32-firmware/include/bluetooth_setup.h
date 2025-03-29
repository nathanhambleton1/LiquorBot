/*
 * -----------------------------------------------------------------------------
 *  Project: Liquor Bot
 *  File: bluetooth_setup.h
 *  Description: Declares functions for setting up Bluetooth Low Energy (BLE) 
 *               to receive Wi-Fi credentials for provisioning the device.
 * 
 *  Author: Nathan Hambleton
 * -----------------------------------------------------------------------------
 */

#ifndef BLUETOOTH_SETUP_H
#define BLUETOOTH_SETUP_H

#include <string>

// Function to initialize BLE for Wi-Fi provisioning
void setupBluetoothWiFiAWS();

// Function to check if Wi-Fi credentials have been received
bool areCredentialsReceived();

#endif // BLUETOOTH_SETUP_H
