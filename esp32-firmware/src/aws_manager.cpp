#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include "aws_manager.h"
#include "certs.h"
#include "drink_controller.h"
#include <ArduinoJson.h>

/**
 * Declare WiFiClientSecure and PubSubClient globally.
 */
WiFiClientSecure secureClient;
PubSubClient mqttClient(secureClient);

/**
 * Set up AWS IoT.
 * - Configure certificates.
 * - Connect to AWS IoT.
 * - Subscribe to both command topic (AWS_RECEIVE_TOPIC) and
 *   the 'liquorbot/heartbeat' topic so we can respond to CHECK requests.
 */
void setupAWS() {
    // Configure AWS IoT certificates and keys
    secureClient.setCACert(AWS_ROOT_CA);
    secureClient.setCertificate(DEVICE_CERT);
    secureClient.setPrivateKey(PRIVATE_KEY);

    // Set MQTT server and callback for incoming data
    mqttClient.setServer(AWS_IOT_ENDPOINT, 8883);
    mqttClient.setCallback(receiveData);

    // Connect (retries until success)
    while (!mqttClient.connected()) {
        Serial.println("Connecting to AWS IoT...");
        if (mqttClient.connect("LiquorBot-001")) { // Our client ID
            Serial.println("Connected to AWS IoT!");
            
            // 1) Subscribe to the command topic for drink instructions
            mqttClient.subscribe(AWS_RECEIVE_TOPIC);

            // 2) Also subscribe to 'liquorbot/heartbeat' so we can respond to "CHECK"
            mqttClient.subscribe("liquorbot/heartbeat");
            
        } else {
            Serial.print("AWS IoT connection failed, rc=");
            Serial.println(mqttClient.state());
            delay(2000);
        }
    }
}

/**
 * Called frequently from loop() to maintain MQTT connection
 * and handle inbound messages (via mqttClient.loop()).
 */
void processAWSMessages() {
    if (!mqttClient.connected()) {
        setupAWS(); // Reconnect if disconnected
    }
    mqttClient.loop(); // Handle incoming messages
}

/**
 * The callback for all subscribed topics (both 'heartbeat' and command).
 * We'll branch logic based on which 'topic' we got and what 'command' is.
 */
void receiveData(char* topic, byte* payload, unsigned int length) {
    String message = String((char*)payload).substring(0, length);
    String topicStr = String(topic);

    Serial.println("---------------------------------------------------");
    Serial.println("Incoming MQTT message");
    Serial.println("Topic: " + topicStr);
    Serial.println("Payload: " + message);
    Serial.println("---------------------------------------------------");

    // 1) If we got the heartbeat topic
    if (topicStr.equals("liquorbot/heartbeat")) {

        // 1) Allocate a small JSON buffer
        StaticJsonDocument<128> doc; 
        DeserializationError err = deserializeJson(doc, message);

        if (!err) {
            // 2) Check if doc["content"] == "CHECK"
            const char* content = doc["content"];
            if (content && String(content).equals("CHECK")) {
                // The app is asking, "Are you alive?"
                // Respond with "OK" so the app knows we're connected
                sendData("liquorbot/heartbeat", "{\"content\": \"OK\"}");
                Serial.println("Responded to CHECK with OK");
            } else {
                // Possibly app's normal heartbeat or something else
                Serial.println("Heartbeat message not recognized. No 'content' == 'CHECK'.");
            }
        } else {
            // If we can't parse the JSON, or it wasn't JSON
            Serial.println("Received non-JSON or invalid JSON in heartbeat topic, ignoring.");
        }
    }
    // 2) Otherwise, if it's our command topic for drink instructions
    else if (topicStr.equals(AWS_RECEIVE_TOPIC)) {
        // Assume the message is a drink command, parse & dispense
        auto parsedCommand = parseDrinkCommand(message);
        dispenseDrink(parsedCommand);
    }
    // 3) Otherwise, we got something on some unexpected topic
    else {
        Serial.println("Received message on an unrecognized topic, ignoring.");
    }
}

/**
 * Publish a message to any topic.
 */
void sendData(const String& topic, const String& message) {
    if (mqttClient.connected()) {
        mqttClient.publish(topic.c_str(), message.c_str());
        Serial.println("Published to [" + topic + "]: " + message);
    } else {
        Serial.println("Cannot publish. MQTT not connected.");
    }
}

/**
 * Send a heartbeat JSON message. Called every 10s by the main loop.
 */
void sendHeartbeat() {
    const String heartbeatTopic = "liquorbot/heartbeat";
    // Using valid JSON so the app won't parse-error
    const String heartbeatMessage = "{\"msg\": \"heartbeat\"}";
    sendData(heartbeatTopic, heartbeatMessage);
}
