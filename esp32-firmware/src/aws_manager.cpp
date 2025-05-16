/*  aws_manager.cpp  – all AWS‑IoT + slot‑config logic
 *  Uses the LIQUORBOT_ID & topic macros declared in aws_manager.h
 *  Author: Nathan Hambleton (refactored for single‑ID macro)
 * -------------------------------------------------------------------------- */

#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include "aws_manager.h"       // brings in LIQUORBOT_ID + all topic macros
#include "certs.h"
#include "drink_controller.h"
#include <ArduinoJson.h>

/* ---------- NVS for slot‑config persistence ---------- */
#include <Preferences.h>
static Preferences prefs;

/* Up to 15 slots (adjust if needed) */
static uint16_t slotConfig[15] = {0};

/* Wi‑Fi + MQTT objects */
WiFiClientSecure secureClient;
PubSubClient     mqttClient(secureClient);

/* ---------- forward decls ---------- */
static void handleSlotConfigMessage(const String& json);
static void loadSlotConfigFromNVS();
static void saveSlotConfigToNVS();

/* -------------------------------------------------------------------------- */
/*                               AWS SETUP                                    */
/* -------------------------------------------------------------------------- */
void setupAWS() {
    secureClient.setCACert(AWS_ROOT_CA);
    secureClient.setCertificate(DEVICE_CERT);
    secureClient.setPrivateKey(PRIVATE_KEY);

    prefs.begin("slotconfig", /*readOnly=*/false);
    loadSlotConfigFromNVS();

    mqttClient.setServer(AWS_IOT_ENDPOINT, 8883);
    mqttClient.setCallback(receiveData);

    while (!mqttClient.connected()) {
        Serial.println("Connecting to AWS IoT…");
        if (mqttClient.connect(MQTT_CLIENT_ID)) {
            Serial.println("✔ Connected!");

            /* command + heartbeat + slot‑config */
            mqttClient.subscribe(AWS_PUBLISH_TOPIC);
            mqttClient.subscribe(HEARTBEAT_TOPIC);
            mqttClient.subscribe(SLOT_CONFIG_TOPIC);
        } else {
            Serial.printf("✖ MQTT connect failed (rc=%d). Retrying…\n",
                          mqttClient.state());
            delay(2000);
        }
    }
}

/* Keep the connection alive and process inbound packets */
void processAWSMessages() {
    if (!mqttClient.connected()) setupAWS();
    mqttClient.loop();
}

/* -------------------------------------------------------------------------- */
/*                       MQTT MESSAGE HANDLER (callback)                      */
/* -------------------------------------------------------------------------- */
void receiveData(char* topic, byte* payload, unsigned int length) {
    String message  = String((char*)payload).substring(0, length);
    String topicStr = String(topic);

    /* 1 · Heartbeat ping (ignore) */
    if (topicStr == HEARTBEAT_TOPIC) {
        /* do nothing – app merely checks liveness */
    }

    /* 3 · Drink command on new publish topic */
    else if (topicStr == AWS_PUBLISH_TOPIC) {
        auto cmd = parseDrinkCommand(message);

        if (cmd.empty()) {                           // sanity check
            sendData(AWS_RECEIVE_TOPIC,
                    "{\"status\":\"fail\",\"error\":\"empty_command\"}");
            Serial.println("✖ Empty command – FAIL sent.");
            return;
        }

        dispenseDrink(cmd);                          // blocking; returns when done
        sendData(AWS_RECEIVE_TOPIC, "{\"status\":\"success\"}");
        Serial.println("✔ Drink dispensed – SUCCESS sent.");
    }

    /* 3 · Slot‑config JSON */
    else if (topicStr == SLOT_CONFIG_TOPIC) {
        handleSlotConfigMessage(message);
    }

    /* 4 · Unknown topic */
    else {
        Serial.println("Unrecognized topic – ignored.");
    }
}

/* -------------------------------------------------------------------------- */
/*                    SLOT‑CONFIG JSON MESSAGE PARSER                         */
/* -------------------------------------------------------------------------- */
static void handleSlotConfigMessage(const String& json) {
    StaticJsonDocument<256> doc;
    if (deserializeJson(doc, json)) {
        Serial.println("Bad slot‑config JSON – ignored.");
        return;
    }

    const char* action = doc["action"];
    if (!action) return;

    /* GET_CONFIG → send CURRENT_CONFIG */
    if (strcmp(action, "GET_CONFIG") == 0) {
        StaticJsonDocument<256> resp;
        resp["action"] = "CURRENT_CONFIG";
        JsonArray arr  = resp.createNestedArray("slots");
        for (uint8_t i = 0; i < 15; ++i) arr.add(slotConfig[i]);

        String out;
        serializeJson(resp, out);
        sendData(SLOT_CONFIG_TOPIC, out);
        Serial.println("Sent CURRENT_CONFIG");
    }

    /* SET_SLOT */
    else if (strcmp(action, "SET_SLOT") == 0) {
        int slotIdx      = doc["slot"];        // 1‑based from app
        int ingredientId = doc["ingredientId"];
        if (slotIdx >= 1 && slotIdx <= 15) {
            slotConfig[slotIdx - 1] = ingredientId;
            saveSlotConfigToNVS();
            Serial.printf("Slot %d ← %d\n", slotIdx, ingredientId);
        } else {
            Serial.println("Slot index out of range (1‑15).");
        }
    }

    /* CLEAR_CONFIG */
    else if (strcmp(action, "CLEAR_CONFIG") == 0) {
        memset(slotConfig, 0, sizeof(slotConfig));
        saveSlotConfigToNVS();
        Serial.println("All slots cleared.");
    }
}

/* -------------------------------------------------------------------------- */
/*                           PUBLISH HELPERS                                  */
/* -------------------------------------------------------------------------- */
void sendData(const String& topic, const String& msg) {
    if (mqttClient.connected()) {
        mqttClient.publish(topic.c_str(), msg.c_str());
        Serial.printf("→ %s : %s\n", topic.c_str(), msg.c_str());
    } else {
        Serial.println("MQTT not connected; publish skipped.");
    }
}

void sendHeartbeat() {
    sendData(HEARTBEAT_TOPIC, "{\"msg\":\"heartbeat\"}");
}

/* -------------------------------------------------------------------------- */
/*                       NVS SAVE / LOAD HELPERS                              */
/* -------------------------------------------------------------------------- */
static void loadSlotConfigFromNVS() {
    for (uint8_t i = 0; i < 15; ++i) {
        char key[8];
        snprintf(key, sizeof(key), "slot%d", i);
        slotConfig[i] = prefs.getUInt(key, 0);
    }
    Serial.println("Slot config loaded from NVS.");
}

static void saveSlotConfigToNVS() {
    for (uint8_t i = 0; i < 15; ++i) {
        char key[8];
        snprintf(key, sizeof(key), "slot%d", i);
        prefs.putUInt(key, slotConfig[i]);
    }
    Serial.println("Slot config saved to NVS.");
}
