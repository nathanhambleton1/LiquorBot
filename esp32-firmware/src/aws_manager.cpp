/*  aws_manager.cpp  – AWS‑IoT + slot‑config logic (non‑blocking pour)
 *  Author: Nathan Hambleton – refactor 16 May 2025 by ChatGPT
 * -------------------------------------------------------------------------- */

#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "aws_manager.h"     // LIQUORBOT_ID & topic macros
#include "certs.h"
#include "drink_controller.h"
#include "state_manager.h"
#include "wifi_setup.h"

/* ---------- NVS for slot‑config persistence ---------- */
#include <Preferences.h>
static Preferences prefs;

/* Up to 15 slots (adjust if needed) */
static uint16_t slotConfig[15] = {0};

/* Wi‑Fi + MQTT objects */
WiFiClientSecure secureClient;
PubSubClient     mqttClient(secureClient);

/* ---------- pour‑result hand‑off (from FreeRTOS task → main loop) ---------- */
static volatile bool   pourResultPending = false;
static String          pourResultMessage;

void notifyPourResult(bool success, const char *error /*=nullptr*/) {
    /* Build JSON once; send from processAWSMessages() in main loop */
    StaticJsonDocument<128> doc;
    doc["status"] = success ? "success" : "fail";
    if (!success && error) doc["error"] = error;
    serializeJson(doc, pourResultMessage);
    pourResultPending = true;
}

/* ---------- forward decls ---------- */
static void handleSlotConfigMessage(const String &json);
static void loadSlotConfigFromNVS();
static void saveSlotConfigToNVS();

/* -------------------------------------------------------------------------- */
/*                               AWS SETUP                                    */
/* -------------------------------------------------------------------------- */
void setupAWS() {
    secureClient.setCACert(AWS_ROOT_CA);
    secureClient.setCertificate(DEVICE_CERT);
    secureClient.setPrivateKey(PRIVATE_KEY);

    prefs.begin("slotconfig", false);
    loadSlotConfigFromNVS();

    mqttClient.setServer(AWS_IOT_ENDPOINT, 8883);
    mqttClient.setCallback(receiveData);
}

/* Keep the connection alive and process inbound packets */
void processAWSMessages() {
    if (!mqttClient.connected()) {
        // Non-blocking connection attempt
        if (mqttClient.connect(MQTT_CLIENT_ID)) {
            mqttClient.subscribe(AWS_PUBLISH_TOPIC);
            // ... other subscriptions ...
        }
    }
    mqttClient.loop();

    /* send pour‑result if the background task finished */
    if (pourResultPending) {
        sendData(AWS_RECEIVE_TOPIC, pourResultMessage);
        pourResultPending = false;
    }
}

/* -------------------------------------------------------------------------- */
/*                       MQTT MESSAGE HANDLER (callback)                      */
/* -------------------------------------------------------------------------- */
void receiveData(char *topic, byte *payload, unsigned int length) {
    String message  = String((char *)payload).substring(0, length);
    String topicStr = String(topic);

    /* 1 · Heartbeat ping (ignore) */
    if (topicStr == HEARTBEAT_TOPIC) {
        return; // nothing else
    }

    /* 2 · Drink command */
    if (topicStr == AWS_PUBLISH_TOPIC) {
        if (isBusy()) {
            sendData(AWS_RECEIVE_TOPIC, "{\"status\":\"fail\",\"error\":\"busy\"}");
            Serial.println("✖ Busy – drink rejected.");
            return;
        }

        /* Kick off non‑blocking FreeRTOS task */
        startPourTask(message);
        return; // main loop continues running
    }

    /* 3 · Slot‑config JSON */
    if (topicStr == SLOT_CONFIG_TOPIC) {
        handleSlotConfigMessage(message);
        return;
    }
    
    /* 4 · Maintenance actions (including DISCONNECT_WIFI) */
    if (topicStr == MAINTENANCE_TOPIC) {
        StaticJsonDocument<96> doc;
        if (deserializeJson(doc, message)) return;
        const char *action = doc["action"];

        if      (strcmp(action, "DISCONNECT_WIFI") == 0) {
            sendData(MAINTENANCE_TOPIC,
                     "{\"status\":\"ok\",\"note\":\"disconnecting\"}");
            disconnectFromWiFi();    // never returns (ESP.restart)
        }
        /* READY_SYSTEM / EMPTY_SYSTEM / DEEP_CLEAN handled elsewhere */
        return;
    }

    /* 5 · Unknown topic */
    Serial.println("Unrecognized topic – ignored.");
}

/* -------------------------------------------------------------------------- */
/*                    SLOT‑CONFIG JSON MESSAGE PARSER                         */
/* -------------------------------------------------------------------------- */
static void handleSlotConfigMessage(const String &json) {
    StaticJsonDocument<256> doc;
    if (deserializeJson(doc, json)) {
        Serial.println("Bad slot‑config JSON – ignored.");
        return;
    }

    const char *action = doc["action"];
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
        int slotIdx      = doc["slot"];       // 1‑based from app
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
void sendData(const String &topic, const String &msg) {
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
