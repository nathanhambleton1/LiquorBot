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

void setupBluetooth(); 
bool areCredentialsReceived();
void  notifyWiFiReady();

#endif // BLUETOOTH_SETUP_H
