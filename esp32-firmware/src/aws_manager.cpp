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
#include "bluetooth_setup.h"
#include "maintenance_controller.h"

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
    StaticJsonDocument<128> doc;
    doc["status"] = success ? "success" : "fail";
    if (!success && error) doc["error"] = error;
    serializeJson(doc, pourResultMessage);
    pourResultPending = true;
    if (success) {
        setState(State::IDLE);
        Serial.println("→ State set to IDLE after pour");
    } else {
        setState(State::ERROR);
        Serial.printf("→ State set to ERROR after pour fail: %s\n", error ? error : "unknown");
    }
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
    static bool sentReady = false;

    /* ---------- (re)connect ---------- */
    if (!mqttClient.connected()) {
        if (mqttClient.connect(MQTT_CLIENT_ID)) {
            /* subscribe to ALL control topics for this bot */
            mqttClient.subscribe(AWS_PUBLISH_TOPIC);   // drink commands
            mqttClient.subscribe(SLOT_CONFIG_TOPIC);   // slot-config RPC
            mqttClient.subscribe(MAINTENANCE_TOPIC);   // deep-clean, etc.
            mqttClient.subscribe(HEARTBEAT_TOPIC);     // ping / ignore
            Serial.println("✔ MQTT connected & topics subscribed");
            sentReady = false;                        // re-signal after reconnect
        }
    }

    /* ---------- first time MQTT is up → notify BLE char = "1" ---------- */
    if (mqttClient.connected() && !sentReady) {
        notifyWiFiReady();   // sets status char + kicks BLE central
        sentReady = true;
    }

    mqttClient.loop();      // process packets

    /* ---------- deferred pour-result publish ---------- */
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

    /* 1 · Heartbeat ping (ignore) */
    if (topicStr == HEARTBEAT_TOPIC) {
        return; // nothing else
    }

    /* 2 · Drink command */
    if (topicStr == AWS_PUBLISH_TOPIC) {
        // try parsing as a JSON string literal, otherwise strip quotes
        String cmd;
        StaticJsonDocument<64> jdoc;
        if (deserializeJson(jdoc, message) == DeserializationError::Ok) {
            cmd = jdoc.as<const char*>(); 
        } else {
            cmd = message;
            if (cmd.startsWith("\"") && cmd.endsWith("\"")) {
                cmd = cmd.substring(1, cmd.length() - 1);
            }
        }

        Serial.printf("[AWS] Drink command received: %s\n", cmd.c_str());
        if (getCurrentState() != State::IDLE) {
            sendData(AWS_RECEIVE_TOPIC, "{\"status\":\"fail\",\"error\":\"busy\"}");
            Serial.printf("✖ Busy – drink rejected. Current state: %d\n", (int)getCurrentState());
            return;
        }
        setState(State::POURING);
        Serial.println("→ State set to POURING");
        /* Kick off non-blocking FreeRTOS task with the clean command */
        startPourTask(cmd);
        return; // main loop continues running
    }

    /* 3 · Slot‑config JSON */
    if (topicStr == SLOT_CONFIG_TOPIC) {
        handleSlotConfigMessage(message);
        return;
    }
    
    /* 4 · Maintenance actions (including DISCONNECT_WIFI) */
    if (topicStr == MAINTENANCE_TOPIC) {
        // Parse the message and ignore if it's a status response (status == "ok")
        StaticJsonDocument<96> doc;
        if (deserializeJson(doc, message)) return;
        const char *status = doc["status"];
        if (status && strcmp(status, "ok") == 0) {
            Serial.println("[AWS] Maintenance status OK response ignored.");
            return;
        }
        const char *action = doc["action"];
        if (!action) return;

        if (strcmp(action, "DISCONNECT_WIFI") == 0) {
            sendData(MAINTENANCE_TOPIC,
                     "{\"status\":\"ok\",\"note\":\"disconnecting\"}");
            disconnectFromWiFi();    // never returns (ESP.restart)
        } else if (strcmp(action, "READY_SYSTEM") == 0) {
            startReadySystemTask();
        } else if (strcmp(action, "EMPTY_SYSTEM") == 0) {
            startEmptySystemTask();
        } else if (strcmp(action, "DEEP_CLEAN") == 0) {
            startDeepCleanTask();
        }
        // All maintenance actions handled above
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
    if (!mqttClient.connected()) {
        Serial.println("MQTT not connected; publish skipped.");
        return;
    }
    // Publish and immediately service the network to flush it out
    Serial.printf("→ %s : %s\n", topic.c_str(), msg.c_str());
    mqttClient.publish(topic.c_str(), msg.c_str());
    mqttClient.loop();   // <— ensures the packet goes out right away
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
