/*
 * -----------------------------------------------------------------------------
 *  Project: Liquor Bot
 *  File: aws_manager.cpp
 *  Description: Handles AWS IoT communication for the cocktail-making robot.
 *               This module manages MQTT connectivity, message processing, 
 *               and secure communication with AWS IoT.
 * 
 *  Author: Nathan Hambleton
 * 
 * Example Drink Command 1:
 * 1:2.0:1,2:1.5:1,3:1.0:2,4:0.5:2,5:1.0:3
 * 
        Slot #	Amount (oz)	Priority
          1	      2.0 oz	   1
          2	      1.5 oz	   1
          3	      1.0 oz	   2
          4	      0.5 oz	   2
          5	      1.0 oz	   3

1:0.5:1,2:0.5:2,3:0.5:3,4:0.5:4,5:0.5:5,6:0.5:6,7:0.5:7,8:0.5:8,9:0.5:9,10:0.5:10,11:0.5:11,12:0.5:12,13:0.5:13,14:0.5:14,15:0.5:15,16:0.5:16

 * -----------------------------------------------------------------------------
 */
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include "aws_manager.h"
#include "certs.h"
#include "drink_controller.h"

WiFiClientSecure secureClient;    // Secure Wi-Fi client for encrypted communication
PubSubClient mqttClient(secureClient); // MQTT client

void setupAWS() {
    // Configure AWS IoT certificates and keys
    secureClient.setCACert(AWS_ROOT_CA);
    secureClient.setCertificate(DEVICE_CERT);
    secureClient.setPrivateKey(PRIVATE_KEY);

    mqttClient.setServer(AWS_IOT_ENDPOINT, 8883);
    mqttClient.setCallback(receiveData);

    // Connect to AWS IoT
    while (!mqttClient.connected()) {
        Serial.println("Connecting to AWS IoT...");
        if (mqttClient.connect("LiquorBot-001")) { // Use the client ID
            Serial.println("Connected to AWS IoT!");
            mqttClient.subscribe(AWS_RECEIVE_TOPIC); // Subscribe to command topic
        } else {
            Serial.print("AWS IoT connection failed, rc=");
            Serial.println(mqttClient.state());
            delay(2000);
        }
    }
}

void processAWSMessages() {
    if (!mqttClient.connected()) {
        setupAWS(); // Reconnect if disconnected
    }
    mqttClient.loop(); // Handle incoming messages
}

void receiveData(char* topic, byte* payload, unsigned int length) {
    String command = String((char*)payload).substring(0, length);
    Serial.println("Received from [" + String(topic) + "]: " + command);
    auto parsedCommand = parseDrinkCommand(command);
    dispenseDrink(parsedCommand);
}

void sendData(const String& topic, const String& message) {
    if (mqttClient.connected()) {
        mqttClient.publish(topic.c_str(), message.c_str());
        Serial.println("Published to [" + topic + "]: " + message);
    } else {
        Serial.println("Cannot publish. MQTT not connected.");
    }
}