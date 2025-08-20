
/*  aws_manager.cpp  – AWS‑IoT + slot‑config logic (non‑blocking pour)
 *  Author: Nathan Hambleton – refactor 16 May 2025 by ChatGPT
 * -------------------------------------------------------------------------- */

#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include "aws_manager.h"     // LIQUORBOT_ID & topic macros
#include "certs.h"
#include "drink_controller.h"
#include "state_manager.h"
#include "wifi_setup.h"
#include "bluetooth_setup.h"
#include "maintenance_controller.h"
#include "pressure_pad.h"

#define FLOW_CALIB_TOPIC  "liquorbot/liquorbot" LIQUORBOT_ID "/calibrate/flow"
// Flow calibration (max 5 rates, linear/log fit)
static float flowRatesLps[5] = {0};
static int   flowRateCount = 0;
static char  flowFitType[8] = "";
static float flowFitA = 0, flowFitB = 0;

static Preferences prefs;

/* Up to 15 slots (adjust if needed) */
static uint16_t slotConfig[15] = {0};
static float    slotVolumes[15] = {0}; // volume per slot, stored in liters (L)

// Get slot count from first two digits of LIQUORBOT_ID

static uint8_t getSlotCount() {
    return (LIQUORBOT_ID[0] - '0') * 10 + (LIQUORBOT_ID[1] - '0');
}

void saveFlowCalibrationToNVS(const float *ratesLps, int count, const char *fitType, float a, float b) {
    prefs.begin("flowcalib", false);
    prefs.putInt("count", count);
    for (int i = 0; i < count && i < 5; ++i) {
        char key[8]; snprintf(key, sizeof(key), "r%d", i);
        prefs.putFloat(key, ratesLps[i]);
    }
    prefs.putString("fit", fitType);
    prefs.putFloat("a", a);
    prefs.putFloat("b", b);
    prefs.end();
}

bool loadFlowCalibrationFromNVS(float *ratesLps, int &count, char *fitType, float &a, float &b) {
    prefs.begin("flowcalib", true);
    count = prefs.getInt("count", 0);
    for (int i = 0; i < count && i < 5; ++i) {
        char key[8]; snprintf(key, sizeof(key), "r%d", i);
        ratesLps[i] = prefs.getFloat(key, 0);
    }
    String fit = prefs.getString("fit", "");
    strncpy(fitType, fit.c_str(), 7); fitType[7] = 0;
    a = prefs.getFloat("a", 0);
    b = prefs.getFloat("b", 0);
    prefs.end();
    return count > 0;
}

/* Wi‑Fi + MQTT objects */
WiFiClientSecure secureClient;
PubSubClient     mqttClient(secureClient);

/* ---------- pour‑result hand‑off (from FreeRTOS task → main loop) ---------- */
static volatile bool   pourResultPending = false;
static String          pourResultMessage;

// ---------- volume config hand-off (non-blocking) ----------
static volatile bool   volumeConfigPending = false;
static String          volumeConfigMessage;

// Replace single pending update with a small ring buffer of updates
struct VolumeUpdate { uint8_t slot; float volumeL; };
static constexpr uint8_t VU_CAP = 16;
static volatile uint8_t vuHead = 0; // write index
static volatile uint8_t vuTail = 0; // read index
static VolumeUpdate vuQueue[VU_CAP];

static inline bool vuIsEmpty() { return vuHead == vuTail; }
static inline bool vuIsFull()  { return (uint8_t)(vuHead + 1) % VU_CAP == vuTail; }
static void enqueueVolumeUpdate(uint8_t slot, float volL) {
    uint8_t next = (uint8_t)(vuHead + 1) % VU_CAP;
    if (next == vuTail) {
        // queue full – drop oldest (advance tail)
        vuTail = (uint8_t)(vuTail + 1) % VU_CAP;
    }
    vuQueue[vuHead] = { slot, volL };
    vuHead = next;
}

void sendVolumeConfig() {
    StaticJsonDocument<256> doc;
    doc["action"] = "CURRENT_VOLUMES";
    doc["unit"] = "L"; // values are liters
    JsonArray arr = doc.createNestedArray("volumes");
    uint8_t slotCount = getSlotCount();
    // FIX: Ensure we send exactly slotCount entries
    for (int i = 0; i < slotCount; ++i) {
        arr.add(slotVolumes[i]);
    }
    serializeJson(doc, volumeConfigMessage);
    volumeConfigPending = true;
}

void notifyVolumeUpdate(uint8_t slot, float volume) {
    // Keep legacy helper but route into queue
    enqueueVolumeUpdate(slot, volume);
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
            mqttClient.subscribe(FLOW_CALIB_TOPIC);    // flow calibration
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
    /* ---------- deferred volume-config publish ---------- */
    if (volumeConfigPending) {
        sendData(SLOT_CONFIG_TOPIC, volumeConfigMessage);
        volumeConfigPending = false;
    }
    // Drain queued VOLUME_UPDATED events (volumes in liters)
    while (!vuIsEmpty()) {
        VolumeUpdate vu = vuQueue[vuTail];
        vuTail = (uint8_t)(vuTail + 1) % VU_CAP;
        StaticJsonDocument<96> doc;
        doc["action"] = "VOLUME_UPDATED";
        doc["slot"] = vu.slot;          // zero-based index
    doc["volume"] = vu.volumeL;    // liters
        doc["unit"] = "L";
        String out; serializeJson(doc, out);
        sendData(SLOT_CONFIG_TOPIC, out);
    }
}

/* -------------------------------------------------------------------------- */
/*                       MQTT MESSAGE HANDLER (callback)                      */
/* -------------------------------------------------------------------------- */
void receiveData(char *topic, byte *payload, unsigned int length) {
    String message  = String((char *)payload).substring(0, length);
    String topicStr = String(topic);
    // 0 · Flow calibration
    if (String(topic) == FLOW_CALIB_TOPIC) {
        StaticJsonDocument<256> doc;
        if (deserializeJson(doc, message) == DeserializationError::Ok) {
            // Parse array of rates (L/s), fit type, a, b
            JsonArray arr = doc["rates_lps"];
            int n = 0;
            for (JsonVariant v : arr) {
                if (n < 5) flowRatesLps[n++] = v.as<float>();
            }
            flowRateCount = n;
            String fit = doc["fit"]["type"] | "";
            strncpy(flowFitType, fit.c_str(), 7); flowFitType[7] = 0;
            flowFitA = doc["fit"]["a"] | 0.0f;
            flowFitB = doc["fit"]["b"] | 0.0f;
            saveFlowCalibrationToNVS(flowRatesLps, flowRateCount, flowFitType, flowFitA, flowFitB);
            Serial.printf("[CALIB] Flow calibration received: %d rates, fit=%s a=%.4f b=%.4f\n", flowRateCount, flowFitType, flowFitA, flowFitB);
        } else {
            Serial.println("[CALIB] Bad calibration JSON – ignored.");
        }
        return;
    }

    /* 1 · Heartbeat ping or check */
    if (topicStr == HEARTBEAT_TOPIC) {
        // If this is a heartbeat check request, respond immediately
        StaticJsonDocument<64> doc;
        if (!deserializeJson(doc, message)) {
            const char *action = doc["action"];
            if (action && strcmp(action, "HEARTBEAT_CHECK") == 0) {
                sendHeartbeat();
                return;
            }
        }
        // Otherwise, ignore
        return;
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
            StaticJsonDocument<64> doc;
            doc["status"] = "fail";
            /* Distinguish *why* we're busy. */
            switch (getCurrentState()) {
            case State::POURING:      doc["error"] = "Device Already In Use";      break;
            case State::MAINTENANCE:  doc["error"] = "Device In Maintenance Mode";  break;
            default:                  doc["error"] = "Device Busy";              break;
            }
            String out;  serializeJson(doc, out);
            sendData(AWS_RECEIVE_TOPIC, out);
            Serial.printf("✖ Busy – drink rejected. Current state: %d\n", (int)getCurrentState());
            return;
        }

        // Require cup present BEFORE starting any pour processing
        if (!isCupPresent()) {
            StaticJsonDocument<128> doc;
            doc["status"] = "fail";
            doc["error"]  = "No Glass Detected - place glass to start";
            String out; serializeJson(doc, out);
            sendData(AWS_RECEIVE_TOPIC, out);
            Serial.println("✖ Pour rejected – no glass detected.");
            return; // do not change state or start the pour task
        }
        setState(State::POURING);
        Serial.println("→ State set to POURING");
        /* Kick off non-blocking FreeRTOS task with the clean command */
        startPourTask(cmd);
        return; // main loop continues running
    }

    /* 3 · Slot‑config JSON or volume messages */
    if (topicStr == SLOT_CONFIG_TOPIC) {
        // Try to parse as JSON
        StaticJsonDocument<128> doc;
        if (deserializeJson(doc, message) == DeserializationError::Ok) {
            // Check for volume get/set
            const char *action = doc["action"];
            uint8_t slotCount = getSlotCount();
            if (action && strcmp(action, "GET_VOLUMES") == 0) {
                sendVolumeConfig();
                return;
            }
            if (action && strcmp(action, "SET_VOLUME") == 0) {
                int slot = doc["slot"];
                float vol = doc["volume"];
                // Optional unit; default liters (app uses liters)
                const char *unit = doc["unit"] | "L";
                float volL = vol;
                if (unit) {
                    if (!strcasecmp(unit, "L") || !strcasecmp(unit, "liters") || !strcasecmp(unit, "litres")) {
                        volL = vol;
                    } else if (!strcasecmp(unit, "ML") || !strcasecmp(unit, "milliliters") || !strcasecmp(unit, "millilitres")) {
                        volL = vol / 1000.0f;
                    } else if (!strcasecmp(unit, "OZ") || !strcasecmp(unit, "ounces")) {
                        volL = vol / 33.814f;
                    }
                }
                if (slot >= 0 && slot < slotCount) {
                    slotVolumes[slot] = volL;
                    saveSlotConfigToNVS();
                    enqueueVolumeUpdate((uint8_t)slot, volL);
                }
                return;
            }
        }
        // Otherwise, treat as slot config
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
        uint8_t slotCount = getSlotCount();
        for (uint8_t i = 0; i < slotCount; ++i) arr.add(slotConfig[i]);

        String out;
        serializeJson(resp, out);
        sendData(SLOT_CONFIG_TOPIC, out);
        Serial.println("Sent CURRENT_CONFIG");
    }

    /* SET_SLOT */
    else if (strcmp(action, "SET_SLOT") == 0) {
        int slotIdx      = doc["slot"];       // 1‑based from app
        int ingredientId = doc["ingredientId"];
        uint8_t slotCount = getSlotCount();
        if (slotIdx >= 1 && slotIdx <= slotCount) {
            slotConfig[slotIdx - 1] = ingredientId;
            saveSlotConfigToNVS();
            Serial.printf("Slot %d ← %d\n", slotIdx, ingredientId);
        } else {
            Serial.println("Slot index out of range (1‑slotCount).");
        }
    }

    /* CLEAR_CONFIG */
    else if (strcmp(action, "CLEAR_CONFIG") == 0) {
        uint8_t slotCount = getSlotCount();
        for (uint8_t i = 0; i < slotCount; ++i) slotConfig[i] = 0;
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
    if (topic != HEARTBEAT_TOPIC) {
        Serial.printf("→ %s : %s\n", topic.c_str(), msg.c_str());
    }
    mqttClient.publish(topic.c_str(), msg.c_str());
    mqttClient.loop();   // <— ensures the packet goes out right away
}

void sendHeartbeat() {
    sendData(HEARTBEAT_TOPIC, "{\"msg\":\"heartbeat\"}");
}

/* ---------- Pour result notification (called from FreeRTOS task) ---------- */
void notifyPourResult(bool success, const char *error) {
    StaticJsonDocument<128> doc;
    doc["action"] = "POUR_RESULT";
    doc["success"] = success;
    if (!success && error) {
        doc["error"] = error;
    }
    serializeJson(doc, pourResultMessage);
    pourResultPending = true;
}

/* -------------------------------------------------------------------------- */
/*                       NVS SAVE / LOAD HELPERS                              */
/* -------------------------------------------------------------------------- */
static void loadSlotConfigFromNVS() {
    for (uint8_t i = 0; i < 15; ++i) {
        char key[8];
        snprintf(key, sizeof(key), "slot%d", i);
        slotConfig[i] = prefs.getUInt(key, 0);
        // Load volumes
        snprintf(key, sizeof(key), "vol%d", i);
        slotVolumes[i] = prefs.getFloat(key, 0);
    }
    Serial.println("Slot config and volumes loaded from NVS.");
}

static void saveSlotConfigToNVS() {
    for (uint8_t i = 0; i < 15; ++i) {
        char key[8];
        snprintf(key, sizeof(key), "slot%d", i);
        prefs.putUInt(key, slotConfig[i]);
        // Save volumes
        snprintf(key, sizeof(key), "vol%d", i);
        prefs.putFloat(key, slotVolumes[i]);
    }
    Serial.println("Slot config and volumes saved to NVS.");
}

/* -------------------------------------------------------------------------- */
/*                       PUBLIC VOLUME HELPERS                                */
/* -------------------------------------------------------------------------- */
void useVolumeForSlot(uint8_t slotZeroBased, float ouncesUsed) {
    uint8_t slotCount = getSlotCount();
    if (slotZeroBased >= slotCount) return;
    if (ouncesUsed <= 0) return;
    // Convert ounces to liters for internal storage
    float litersUsed = ouncesUsed / 33.814f;
    float current = slotVolumes[slotZeroBased];
    float updated = current - litersUsed;
    if (updated < 0) updated = 0;
    slotVolumes[slotZeroBased] = updated;
    enqueueVolumeUpdate(slotZeroBased, updated); // enqueue liters
}

void saveVolumesNow() {
    saveSlotConfigToNVS();
}

float getVolumeLitersForSlot(uint8_t slotZeroBased) {
    uint8_t slotCount = getSlotCount();
    if (slotZeroBased >= slotCount) return 0.0f;
    return slotVolumes[slotZeroBased];
}
