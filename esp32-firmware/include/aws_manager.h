#define FLOW_CALIB_TOPIC  "liquorbot/liquorbot" LIQUORBOT_ID "/calibrate/flow"
// Flow calibration storage (max 5 rates, linear/log fit)
void saveFlowCalibrationToNVS(const float *ratesLps, int count, const char *fitType, float a, float b);
bool loadFlowCalibrationFromNVS(float *ratesLps, int &count, char *fitType, float &a, float &b);
// Version that increments every time calibration is saved; use to hot-reload cached values
uint32_t getCalibrationVersion();
#ifndef AWS_MANAGER_H
#define AWS_MANAGER_H

/* ───────  SET YOUR BOT NUMBER HERE  ─────── */
#define LIQUORBOT_ID       "120002"
/* ───────────────────────────────────────────*/

#define AWS_IOT_ENDPOINT   "a2d1p97nzglf1y-ats.iot.us-east-1.amazonaws.com"

/* Topics & client‑ID — literal concatenation happens at compile‑time */
#define AWS_RECEIVE_TOPIC  "liquorbot/liquorbot" LIQUORBOT_ID "/receive"
#define AWS_PUBLISH_TOPIC  "liquorbot/liquorbot" LIQUORBOT_ID "/publish"
#define SLOT_CONFIG_TOPIC  "liquorbot/liquorbot" LIQUORBOT_ID "/slot-config"
#define HEARTBEAT_TOPIC    "liquorbot/liquorbot" LIQUORBOT_ID "/heartbeat"
#define MAINTENANCE_TOPIC  "liquorbot/liquorbot" LIQUORBOT_ID "/maintenance"
#define MQTT_CLIENT_ID     "LiquorBot-" LIQUORBOT_ID

#include <Arduino.h>

/* Function prototypes */
void setupAWS();
void processAWSMessages();
void sendData(const String &topic, const String &message);
void receiveData(char *topic, byte *payload, unsigned int length);
void sendHeartbeat();
void notifyPourResult(bool success, const char *error = nullptr);

/* Volume management helpers (device stores and publishes volumes in liters).
 * Decrement the stored volume for a slot (zero-based index) by ouncesUsed
 * (ounces from the recipe). This converts oz→L internally and clamps at 0,
 * enqueues a VOLUME_UPDATED publish for the app, and lets you persist via
 * saveVolumesNow() after batching.
 */
void useVolumeForSlot(uint8_t slotZeroBased, float ouncesUsed);

/* Persist current slot volumes to NVS immediately. Safe to call after a batch
 * of useVolumeForSlot updates to avoid excessive flash writes.
 */
void saveVolumesNow();

/* Read the current stored volume (liters) for a slot (zero-based).
 * Returns >= 0 liters; slots out of range return 0.
 */
float getVolumeLitersForSlot(uint8_t slotZeroBased);

#endif // AWS_MANAGER_H
