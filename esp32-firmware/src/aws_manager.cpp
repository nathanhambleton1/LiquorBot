#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include "aws_manager.h"
#include "certs.h"
#include "drink_controller.h"
#include <ArduinoJson.h>

// For saving slot config in NVS
#include <Preferences.h>
static Preferences prefs;  // We'll use this for storing config in NVS

/**
 * We will store up to 15 slots (matching your app).
 * You can adjust if you have more or fewer.
 */
static uint16_t slotConfig[15] = {0}; // store ingredient IDs (0 means empty)

/**
 * Declare WiFiClientSecure and PubSubClient globally.
 */
WiFiClientSecure secureClient;
PubSubClient mqttClient(secureClient);

/**
 * Topics we'll subscribe to:
 * - AWS_RECEIVE_TOPIC: for old "drink commands" 
 * - "liquorbot/heartbeat": for heartbeat
 * - "liquorbot/liquorbot001/slot-config": for new slot config commands
 */
static const char* SLOT_CONFIG_TOPIC = "liquorbot/liquorbot001/slot-config";

/**
 * Forward declarations
 */
void handleSlotConfigMessage(const String& message);
void loadSlotConfigFromNVS();
void saveSlotConfigToNVS();

/**
 * Set up AWS IoT.
 * - Configure certificates.
 * - Connect to AWS IoT.
 * - Subscribe to all needed topics.
 */
void setupAWS() {
    // Configure AWS IoT certificates and keys
    secureClient.setCACert(AWS_ROOT_CA);
    secureClient.setCertificate(DEVICE_CERT);
    secureClient.setPrivateKey(PRIVATE_KEY);

    // Initialize preferences so we can read our saved config
    prefs.begin("slotconfig", /* readOnly = */ false);
    loadSlotConfigFromNVS();

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

            // 3) Subscribe to slot-config messages from the app
            mqttClient.subscribe(SLOT_CONFIG_TOPIC);

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
 * The callback for all subscribed topics:
 *  - "liquorbot/heartbeat"
 *  - AWS_RECEIVE_TOPIC (old drink commands)
 *  - SLOT_CONFIG_TOPIC (new slot config commands)
 */
void receiveData(char* topic, byte* payload, unsigned int length) {
    String message = String((char*)payload).substring(0, length);
    String topicStr = String(topic);

    // 1) If we got the heartbeat topic
    if (topicStr.equals("liquorbot/heartbeat")) {
        StaticJsonDocument<128> doc; 
        DeserializationError err = deserializeJson(doc, message);

        if (!err) {
            const char* content = doc["content"];
            if (content && String(content).equals("CHECK")) {
                sendData("liquorbot/heartbeat", "{\"content\": \"OK\"}");
                Serial.println("Responded to CHECK with OK");
            } else if (content && !String(content).equals("heartbeat")) {
                Serial.println("Heartbeat message recognized but 'content' is not 'CHECK'.");
            }
        } else {
            Serial.println("Received invalid JSON in heartbeat topic, ignoring.");
        }
    }

    // 2) If it's the old "AWS_RECEIVE_TOPIC" for drink instructions
    else if (topicStr.equals(AWS_RECEIVE_TOPIC)) {
        // Assume the message is a "drink command", parse & dispense
        auto parsedCommand = parseDrinkCommand(message);
        dispenseDrink(parsedCommand);
    }

    // 3) If it's the new slot config topic
    else if (topicStr.equals(SLOT_CONFIG_TOPIC)) {
        handleSlotConfigMessage(message);
    }

    // 4) Otherwise, unrecognized topic
    else {
        Serial.println("Received message on an unrecognized topic, ignoring.");
    }
}

/**
 * Process the JSON commands from "liquorbot/liquorbot001/slot-config".
 * The app will send something like:
 *   { "action": "GET_CONFIG" }
 *   { "action": "SET_SLOT", "slot": 3, "ingredientId": 8 }
 *   { "action": "CLEAR_CONFIG" }
 */
void handleSlotConfigMessage(const String& message) {
    StaticJsonDocument<256> doc;
    DeserializationError err = deserializeJson(doc, message);
    if (err) {
        Serial.println("Error parsing slot-config JSON. Ignoring message.");
        return;
    }

    const char* action = doc["action"];
    if (!action) {
        Serial.println("No 'action' found in slot-config message. Ignoring.");
        return;
    }

    // 1) GET_CONFIG => publish CURRENT_CONFIG
    if (String(action).equals("GET_CONFIG")) {
        // Construct the JSON with our current slotConfig
        StaticJsonDocument<256> resp;
        resp["action"] = "CURRENT_CONFIG";
        JsonArray arr = resp.createNestedArray("slots");
        for (int i = 0; i < 15; i++) {
            arr.add(slotConfig[i]);
        }
        // Convert to string
        String out;
        serializeJson(resp, out);
        // Publish
        sendData(SLOT_CONFIG_TOPIC, out);
        Serial.println("Responded with CURRENT_CONFIG");
    }

    // 2) SET_SLOT => set slot X to ingredientId
    else if (String(action).equals("SET_SLOT")) {
        int slotIndex = doc["slot"];       // if the app is 1-based
        int ingredientId = doc["ingredientId"];
        if (slotIndex >= 1 && slotIndex <= 15) {
            slotConfig[slotIndex - 1] = ingredientId;
            Serial.printf("Set slot %d to ingredient ID %d\n", slotIndex, ingredientId);

            // Save to NVS
            saveSlotConfigToNVS();
        } else {
            Serial.println("Slot out of range (must be 1-15). Ignoring.");
        }
    }

    // 3) CLEAR_CONFIG => set all slots = 0
    else if (String(action).equals("CLEAR_CONFIG")) {
        for (int i = 0; i < 15; i++) {
            slotConfig[i] = 0;
        }
        saveSlotConfigToNVS();
        Serial.println("Cleared all slot configs.");
    }

    // 4) Unrecognized action
    else {
        Serial.println("Unrecognized slot-config action. Ignoring.");
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

/* ----------------------- NVS PERSISTENCE -----------------------
 * We'll store each slot as a separate uint in NVS.  Key-based on index:
 * e.g. key = "slot0", "slot1", ...
 */
void loadSlotConfigFromNVS() {
    for (int i = 0; i < 15; i++) {
        char key[10];
        snprintf(key, sizeof(key), "slot%d", i);
        slotConfig[i] = prefs.getUInt(key, 0); // default 0 if missing
    }
    Serial.println("Loaded slot config from NVS:");
    for (int i = 0; i < 15; i++) {
        Serial.printf("slot[%d] = %d\n", i, slotConfig[i]);
    }
}

void saveSlotConfigToNVS() {
    for (int i = 0; i < 15; i++) {
        char key[10];
        snprintf(key, sizeof(key), "slot%d", i);
        prefs.putUInt(key, slotConfig[i]);
    }
    Serial.println("Saved slot config to NVS.");
}
