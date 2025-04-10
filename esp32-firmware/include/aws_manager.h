/*
 * -----------------------------------------------------------------------------
 *  Project: Liquor Bot
 *  File: aws_manager.h
 *  Description: Defines constants and function declarations for AWS IoT 
 *               communication, including MQTT topics, message handling, 
 *               and secure connection setup.
 * 
 *  Author: Nathan Hambleton
 * -----------------------------------------------------------------------------
 */

#ifndef AWS_MANAGER_H
#define AWS_MANAGER_H

// Your AWS IoT endpoint (replace with your endpoint)
#define AWS_IOT_ENDPOINT "a2d1p97nzglf1y-ats.iot.us-east-1.amazonaws.com"

// MQTT topics
#define AWS_RECEIVE_TOPIC "liquorbot/publish"
#define AWS_PUBLISH_TOPIC "liquorbot/receive"

#include <Arduino.h>

// Function declarations
void setupAWS();
void processAWSMessages();
void sendData(const String& topic, const String& message);
void receiveData(char* topic, byte* payload, unsigned int length);
void sendHeartbeat();

#endif // AWS_MANAGER_H
