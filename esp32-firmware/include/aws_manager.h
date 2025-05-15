#ifndef AWS_MANAGER_H
#define AWS_MANAGER_H

/* ───────  SET YOUR BOT NUMBER HERE  ─────── */
#define LIQUORBOT_ID       "000"          //  ← change this and re‑flash
/* ───────────────────────────────────────────*/

#define AWS_IOT_ENDPOINT   "a2d1p97nzglf1y-ats.iot.us-east-1.amazonaws.com"

/* Topics & client‑ID — literal concatenation happens at compile‑time */
#define AWS_RECEIVE_TOPIC      "liquorbot/liquorbot" LIQUORBOT_ID "/publish"
#define AWS_PUBLISH_TOPIC      "liquorbot/liquorbot" LIQUORBOT_ID "/receive"
#define SLOT_CONFIG_TOPIC      "liquorbot/liquorbot" LIQUORBOT_ID "/slot-config"
#define HEARTBEAT_TOPIC        "liquorbot/liquorbot" LIQUORBOT_ID "/heartbeat"
#define HEARTBEAT_CHECK_TOPIC  "liquorbot/liquorbot" LIQUORBOT_ID "/heartbeat_check"
#define MQTT_CLIENT_ID         "LiquorBot-" LIQUORBOT_ID

#include <Arduino.h>

/* Function prototypes */
void setupAWS();
void processAWSMessages();
void sendData(const String& topic, const String& message);
void receiveData(char* topic, byte* payload, unsigned int length);
void sendHeartbeat();

#endif // AWS_MANAGER_H
