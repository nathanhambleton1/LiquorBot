# LiquorBot 🍸

A full‑stack, Wifi‑enabled cocktail robot & companion Expo app powered by **AWS Amplify v6**

## Table of Contents

* [Project Vision](#project-vision)
* [Core Features](#core-features)
* [System Architecture](#system-architecture)
* [Repository Layout](#repository-layout)
* [Quick Start](#quickstart)
* [Mobile App (Expo React Native)](#mobile-app-expo-reactnative)
* [Amplify Backend (v6)](#amplify-backendv6)
* [Robot Firmware (ESP32 C++)](#robot-firmware-esp32c)
* [Infrastructure & IoT](#infrastructureiot)
* [Data Models](#datamodels)
* [Development Workflows](#developmentworkflows)
* [Testing](#testing)
* [Troubleshooting & FAQ](#troubleshootingfaq)
* [Screenshots](#screenshots)
* [Roadmap](#roadmap)
* [License](#license)

---

## Project Vision

LiquorBot turns any gathering into a professional cocktail experience.

* Tap‑to‑pour drinks with **millilitre precision**
* Build custom recipes with a visual glass builder
* Curate multi‑day events and granular drink menus
* Remotely maintain the device (prime, empty, deep‑clean)
* Sync everything securely through **AWS Amplify** & **IoT Core**

---

## Core Features

| Category                 | Highlights                                                                                                                                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mobile App**           | Expo + React Native (TypeScript) · Live BLE status · Offline caching · Animations with Skia · Custom recipe builder with SVG glass overlays · **Explore** page that autogenerates themed Recipe Books |
| **Backend (Amplify v6)** | Cognito User/Identity Pools · GraphQL API with owner‑based auth · S3 Storage for drink artwork & logs · PubSub (MQTT bridge) · Lambda triggers for extended workflows                                 |
| **Firmware**             | Non‑blocking FreeRTOS pour task · NCV7240 SPI driver for 16 solenoids · Dual‑pump support · BLE provisioning (Wi‑Fi creds) · AWS‑IoT heartbeat · Persistent slot‑config in NVS                        |
| **Hardware**             | ESP32‑WROOM‑32 · Peristaltic pumps + 24 V solenoid valves · WS2812 LED ring status indicator · Custom PCB / 3‑D printed chassis                                                                       |

---

## System Architecture

```text
┌─────────────────────────────────────────────┐
│                 Mobile App                  │
│ Expo (React Native) <-> AWS Amplify API     │
│  • GraphQL (queries/mutations/subs)         │──────────> 
│  • S3 Storage (drink art, logs)             │           │
│  • Cognito Auth (username/email, social)    │           │
│  • PubSub <––– AWS IoT Core –––>            │           │
└─────────────────────────────────────────────┘           │
                                                          ▼
                                              ┌──────────────────────┐
                                              │   AWS IoT Core       │
                                              │  (MQTT broker)       │
                                              └──────────────────────┘
                                                          ▲
┌─────────────────────────────────────────────┐           │
│               LiquorBot ESP32               │           │
│  FreeRTOS + Arduino Core                    │           │
│  • wifi_setup.cpp  ← BLE Wi‑Fi creds        │           │
│  • aws_manager.cpp <-> PubSub topics (JSON) │ <─────────
│  • drink_controller.cpp (pour task)         │
│  • led_control.cpp (WS2812 ring)            │
└─────────────────────────────────────────────┘
```

---

## Repository Layout

```text
📁 app-firmware/       Expo React‑Native source
│  ├── app/             ↳ create-drink.tsx, menu.tsx, device-settings.tsx …
│  ├── components/      Shared UI & context (LiquorBot provider)
│  └── src/graphql/     Amplify‑generated GraphQL ops
📁 esp32-firmware/      ESP32 C++ sketches & libs
│  ├── main.cpp
│  ├── drink_controller.cpp
│  ├── wifi_setup.cpp, bluetooth_setup.cpp
│  └── aws_manager.cpp
📁 amplify/             Backend stacks (auto‑generated)
│  └── …                auth, api, storage, function resources
📁 assets/              Glass SVGs, icons, placeholder images
📄 README.md            ← **you are here**
```

---

## Quick Start

```bash
# 1 · Clone
git clone https://github.com/your-handle/liquorbot.git
cd liquorbot

# 2 · Install mobile deps
npm i          # or yarn
npx expo prebuild

# 3 · Provision Amplify backend (AWS CLI / Amplify CLI v12+)
npm i -g @aws-amplify/cli
amplify init                       # choose *existing* resources if you already pushed
amplify pull --appId <appId> --envName dev

# 4 · Run the app
npx expo start                     # iOS Simulator / Android emulator / Expo Go

# 5 · Flash firmware (VS Code + PlatformIO)
cd esp32-firmware
pio run -t upload                  # update `platformio.ini` with your serial port

# 6 · Pair over BLE, send Wi‑Fi creds, pour your first drink! 🥂
```

---

## Mobile App (Expo React Native)

### Key Screens

| File                              | Purpose                                                     |
| --------------------------------- | ----------------------------------------------------------- |
| `menu.tsx`                        | Browse drinks, filter “make‑able”, pour via MQTT            |
| `create-drink.tsx`                | **WYSIWYG** custom recipe builder (Skia canvas)             |
| `events.tsx` & `create-event.tsx` | Manage multi‑day events, invite codes, guest lists          |
| `device-settings.tsx`             | Assign ingredients → slots, prime/empty/clean system        |
| `explore.tsx`                     | Auto‑generated Recipe Books with one‑tap **Load to Device** |

#### UI/UX stack

* **Expo Router** for type‑safe navigation
* **React Native Skia** for glass/garnish compositing
* **@expo/vector‑icons** (Ionicons) for icons
* **Animated** & `LayoutAnimation` for micro‑interactions
* **Amplify JS v6** – `generateClient()` (API), `getUrl`/`uploadData` (Storage), `PubSub` (IoT)

---

### Connectivity & Provisioning (BLE + Wi‑Fi)

LiquorBot supports a streamlined first‑time setup and a fast re‑connect path:

- BLE discovery: advertises as `LiquorBot-<ID>`; the app scans for a custom GATT service and will surface a Wi‑Fi row when the device is already online to avoid duplicates.
- Quick handshake: if the device reports it’s already connected to Wi‑Fi, tapping it sets the active LiquorBot ID immediately and the app reconnects MQTT without sending credentials.
- Full provisioning: entering SSID and password over BLE writes to the following characteristics and shows a 3‑step progress modal.
  - Service UUID: `e0be0301-718e-4700-8f55-a24d6160db08`
  - SSID Char: `e0be0302-718e-4700-8f55-a24d6160db08`
  - Password Char: `e0be0303-718e-4700-8f55-a24d6160db08`
  - Status Char (read/monitor): `e0be0304-718e-4700-8f55-a24d6160db08`
- 3‑step modal: Connecting to Wi‑Fi → Connecting to Server → Finalising Setup. A failsafe timeout surfaces wrong‑credentials errors.
- Manual entry: users can directly enter a known LiquorBot ID to connect via MQTT without BLE.

Permissions and resiliency:

- Android runtime permissions are requested for Bluetooth scan/connect and nearby Wi‑Fi scanning.
- iOS shows a helper sheet to enable Bluetooth in Settings when powered off.
- Duplicate suppression merges the currently connected Wi‑Fi device so you don’t see two rows for the same unit.

---

### Device Maintenance & Slot Configuration

From Device Settings, you can prime, empty, clean, calibrate, and assign ingredients to slots.

- Maintenance actions (over MQTT maintenance topic):
  - Load Ingredients (prime) to ensure first pours are instant.
  - Empty System to safely return liquids to bottles before storage.
  - Clean opens a guided Clean Setup with Quick, Custom, and Deep options.
  - Calibrate opens Calibration Setup for pump flow calibration.
- Configure Slots:
  - Reads both CURRENT_CONFIG and CURRENT_VOLUMES and renders only up to the detected `slotCount` per device.
  - Ingredient picker per slot with a companion Volume button (color‑coded: green/yellow/red/gray) to reflect fill level/health.
  - Undo buffer (per user and device) allows one‑tap rollback after Clear All or bulk changes; uses AsyncStorage.
  - Clear All publishes CLEAR_CONFIG and resets local state; Undo restores the previous config via SET_SLOT then GET_CONFIG.
- Advanced/Danger Zone:
  - Disconnect from Device with event‑aware prompts: delete the active event and disconnect all, wait until it ends, or cancel.
  - Disconnect from Wi‑Fi to reboot into BLE pairing mode.

---

### Clean Setup (Quick, Custom, Deep)

- Quick Clean: sends a single QUICK_CLEAN command; shows live progress and success/error states.
- Custom Clean: pick a specific line, then Start/Stop to flush. Redo runs another pass (recommended to rinse). Finish returns to settings.
- Deep Clean: guided per‑slot sequence 1..N; Start/Stop each slot, Redo if needed, Continue advances; concludes with a Final Clean stage.

All flows are resilient to slightly different OK/status payload shapes and recover from temporary disconnections.

---

### Calibration Setup (Flow Rates)

- Five‑step guided timing using a 1‑cup (236.6 mL) measuring cup; records elapsed times for consistent baselines.
- Derives flow rates (L/s) and computes both linear and logarithmic fits; picks the model with the lower SSE (sum of squared errors).
- Publishes discrete rates and the chosen fit parameters to the device; attempts to confirm by requesting the current calibration.
- Visualises both the measured data and the best‑fit curve before you tap Finish.

---

### Events & Overrides

- Event override: joining an active event temporarily switches your active LiquorBot to the event’s device. Your original pairing is preserved and automatically restored when the event ends or you leave the event.
- Owner/guest roles: owners can delete events from Danger Zone; deletion immediately disconnects all guests and resets the device association.

---

### Pouring, Make‑able Filter, and Notifications

- Menu shows “make‑able” drinks based on current slot configuration and per‑slot volumes.
- Pour slider animates and publishes pour commands; ETA is tracked and optional local notifications can announce completion.
- Pours are logged to the backend and pour history is retrievable for users.

---

### Caching & Offline Behavior

- Drinks/ingredients JSON and event lists are cached locally for fast loads and offline browsing.
- Image assets (drink artwork) are cached on device storage to reduce bandwidth and speed up the UI.
- Various UI preferences and transient states are persisted, including undo buffers and device pairing.

---

### Providers & Deep Linking

- LiquorBotProvider: centralizes MQTT heartbeat/connection, slot state, volumes, device ID/pairing, and dynamic `slotCount` per unit.
- DeepLinkProvider: captures app links for joining events (e.g., `join/<code>`) and routes through the auth modal when required.
- Global Auth Modal: sign‑in/up, forgot/confirm, and a session‑loading state that can auto‑close when Amplify resumes a session.

---

### Access Control

- Role‑based gating hides admin‑only tabs and actions for non‑admins and guards guest access to protected screens (e.g., Menu expand/likes).
- GraphQL uses owner/public rules; PubSub uses Cognito auth for MQTT credentials.

## Amplify Backend (v6)

| Category          | Purpose                                             | Notes                                         |
| ----------------- | --------------------------------------------------- | --------------------------------------------- |
| **Auth**          | Cognito User Pool & Identity Pool                   | Social sign‑in ready                          |
| **API (GraphQL)** | Cocktail data, events, user profiles                | Transformer auth rules `@auth(owner, public)` |
| **Storage**       | S3 bucket `liquorbot2be…-dev`                       | Drink artwork, logs                           |
| **PubSub**        | MQTT → AWS IoT Core endpoint                        | Region: `us-east-1`                           |
| **Functions**     | (optional) post‑confirmation hooks, log aggregation | See `/amplify/backend/function`               |

<details>
<summary>Example schema excerpt</summary>

```graphql
type PouredDrink @model @auth(rules: [{allow: public}, {allow: owner}]) {
  id: ID!
  userID: ID!
  drinkID: Int!
  drinkName: String
  volume: Float
  timestamp: AWSDateTime!
}

type CustomRecipe @model @auth(rules: [{allow: public}, {allow: owner}]) {
  id: ID!
  name: String!
  description: String
  ingredients: [RecipeIngredient!]
  image: String
  createdAt: AWSDateTime
}
```

</details>

### Provisioning from scratch

```bash
amplify init          # <project> → React Native, AWS profile
amplify add auth      # defaults (email or username)
amplify add api       # GraphQL, codegen: TypeScript
amplify add storage   # S3 (images, logs)
amplify add notifications push
amplify push          # deploy all resources
```

---

## Robot Firmware (ESP32 C++)

### Features

* **FreeRTOS** pour task – concurrency with non‑blocking SPI driver
* **NCV7240** 16‑channel low‑side driver (daisy‑chained)
* Dynamic flow‑balancing algorithm (`flowRate()` / priority)
* **BLE GATT** service → writes Wi‑Fi SSID & password characteristics
* Persistent slot mapping in **NVS**
* AWS IoT Core TLS 1.2 client (x.509) with custom policy attach

### Building

```bash
cd esp32-firmware
# Open include/certs.h and paste your AWS IoT Root CA, device cert, and private key
pio run                                           # compile
pio run -t upload                                 # flash
pio device monitor -b 115200                      # serial console
```

### MQTT Topics

| Direction    | Topic pattern                         | Payload                           |
| ------------ | ------------------------------------- | --------------------------------- |
| App → Device | `liquorbot/liquorbot{ID}/publish`     | `"<slot>:<oz>:<prio>,..."`        |
| Device → App | `liquorbot/liquorbot{ID}/receive`     | `{ "status":"success" }`          |
| Slot Config  | `liquorbot/liquorbot{ID}/slot-config` | `{ "action":"GET_CONFIG" }`, etc. |
| Maintenance  | `liquorbot/liquorbot{ID}/maintenance` | `{ "action":"DEEP_CLEAN" }`       |
| Heartbeat    | `liquorbot/liquorbot{ID}/heartbeat`   | `{ "msg":"heartbeat" }`           |
| Calibration  | `liquorbot/liquorbot{ID}/calibrate/flow` | `{ "rates_lps":[...], "fit":{ "type":"linear|log", "a":<num>, "b":<num> } }` and `{ "action":"GET_CALIBRATION" }` |

Additional slot‑config and maintenance actions used by the app:

- Slot‑config actions
  - `GET_CONFIG` → device replies with `{ action: "CURRENT_CONFIG", slots: number[] }`
  - `SET_SLOT` with `{ slot: number, ingredientId: number }`
  - `GET_VOLUMES` → device replies with `{ action: "CURRENT_VOLUMES", unit:"L", volumes: number[] }`
  - `SET_VOLUME` with `{ slot: number, volume: number, unit?: "L"|"ML"|"OZ" }` (slot index is 0‑based for volume updates)
  - `CLEAR_CONFIG` resets all slots to 0
- Maintenance actions
  - `READY_SYSTEM` (prime), `EMPTY_SYSTEM`
  - `QUICK_CLEAN`
  - `CUSTOM_CLEAN` with `{ slot: number, op: "START" | "STOP" | "RESUME" }`
  - `DEEP_CLEAN` per slot with `{ slot: number, op: "START" | "STOP" }` and a final stage `DEEP_CLEAN_FINAL`
  - Devices may respond with variations like `*_OK`, `*_DONE`, or `{ status: "OK" }`—the app normalizes these.

Heartbeat actions

- App may send `{ action: "HEARTBEAT_CHECK" }` to `/heartbeat`; device replies immediately.

Calibration actions (flow)

- App publishes `{ rates_lps:number[], fit?:{ type:"linear"|"log", a:number, b:number } }` to `/calibrate/flow`.
- App can request `{ action:"GET_CALIBRATION" }` and the device replies with `{ action:"CURRENT_CALIBRATION", rates_lps:[], fit:{} }`.

---

### Firmware internals (ESP32)

High‑level behavior of the on‑device firmware.

- Modules
  - `main.cpp`: boot → BLE advertise, attempt saved Wi‑Fi, 1s heartbeat, idle LED reacts to cup presence.
  - `aws_manager`: MQTT connect/reconnect, topic handlers (publish/receive/slot‑config/maintenance/heartbeat/calibrate), NVS for slot config, volumes (liters), and calibration.
  - `drink_controller`: non‑blocking FreeRTOS pour task; NCV7240 SPI for 14 lines; DRV8870 pump; outlet GPIO solenoids; ETA emit; staged cleaning.
  - `maintenance_controller`: READY_SYSTEM, EMPTY_SYSTEM, QUICK_CLEAN, CUSTOM_CLEAN (Start/Stop/Resume), DEEP_CLEAN per line + FINAL, EMPTY_INGREDIENT.
  - `wifi_setup`/`bluetooth_setup`: NVS creds, STA connect; BLE GATT provisioning and status notify.
  - `pressure_pad`: EMA‑filtered ADC sampler with hysteresis/debounce → `isCupPresent()`.
  - `led_control`: WS2812 effects: idle/ok/error/success/flash red.

- State machine
  - `SETUP` → `IDLE`; `POURING` for pours; `MAINTENANCE` during service tasks; `ERROR` on failures.
  - Busy states reject new pours with a reason.

- Slots and routing
  - 1..12 ingredients; 13 = water flush; 14 = trash/air purge.
  - Two daisy‑chained NCV7240s; outlet path via GPIO solenoids 1..4.
  - Slot count is derived from the first two digits of `LIQUORBOT_ID` (clamped by hardware max).

- Pour algorithm
  - Input `"slot:ounces[:priority],..."` parsed, grouped by priority; within a group, valves are time‑sliced proportional to remaining ounces using `flowRate(openCount)` from calibration.
  - Safety: cup must be present to start; if removed mid‑pour, pump pauses, quick red flash, resume when replaced; emits status once for removal.
  - Checks stock before starting; publishes ETA; on finish, updates per‑slot volumes (liters) and persists; then staged clean: water → air purge top → trash drain.

- Volumes & units
  - Stored in liters in NVS; publishes `CURRENT_VOLUMES { unit:"L", volumes:number[] }` sized to slotCount.
  - Sends `VOLUME_UPDATED { slot:number, volume:number, unit:"L" }` events as levels change.
  - `SET_VOLUME` supports `L`/`ML`/`OZ` conversion on device.

- Maintenance flows (summarized)
  - READY_SYSTEM (prime): route spout (outlets 1&3), open each ingredient briefly, pump water duty.
  - EMPTY_SYSTEM (backflow): route trash (2&4), open 1..12 + water + trash, pump air duty for `EMPTY_SYSTEM_MS`.
  - QUICK_CLEAN: forward water flush → air purge at top → trash drain; acks `QUICK_CLEAN_OK`.
  - CUSTOM_CLEAN: per‑slot Start/Stop/Resume; Stop does short water→air→trash tidy sequence.
  - DEEP_CLEAN: per‑slot Start/Stop with a `DEEP_CLEAN_FINAL` system flush.
  - EMPTY_INGREDIENT: run a single line until stopped.

- Calibration (flow)
  - Accepts discrete `rates_lps` for 1..N open lines and optional `fit` (linear or log); persists with a version so running pours hot‑reload.
  - Responds to `GET_CALIBRATION` with `CURRENT_CALIBRATION`.

- BLE provisioning
  - Service `e0be0301-718e-4700-8f55-a24d6160db08`; SSID `...302` (WRITE), PASS `...303` (WRITE), STATUS `...304` (READ/NOTIFY).
  - STATUS “1” indicates Wi‑Fi + MQTT up; device then disconnects the central.

- Pressure pad
  - ADC1 on `PRESSURE_ADC_PIN` with optional attenuation; thresholds/debounce in `pin_config.h`.

- LEDs and pins
  - Status effects in `led_control`; all pins and durations centralized in `pin_config.h` (SPI, pump, outlets, LED, pressure, `CLEAN_*_MS`, `QUICK_CLEAN_MS`, `EMPTY_SYSTEM_MS`).


### Pinout overview (from `esp32-firmware/include/pin_config.h`)

| Subsystem  | Signal              | GPIO |
|------------|---------------------|------|
| SPI (NCV)  | MOSI                | 23   |
|            | MISO                | 19   |
|            | SCK                 | 18   |
|            | CS                  | 5    |
| Pump       | IN1 (PWM)           | 16   |
|            | IN2 (LOW)           | 17   |
| Outlets    | OUT_SOL1            | 25   |
|            | OUT_SOL2            | 26   |
|            | OUT_SOL3            | 27   |
|            | OUT_SOL4            | 14   |
| LED        | WS2812 Data         | 4    |
| Pressure   | ADC1 pin            | 32   |

Durations/duty presets (tunable): `CLEAN_WATER_MS=2500`, `CLEAN_AIR_TOP_MS=2000`, `CLEAN_TRASH_MS=3000`, `QUICK_CLEAN_MS=5000`, `EMPTY_SYSTEM_MS=4000`, `DEEP_CLEAN_MS=10000`, `PUMP_WATER_DUTY=255`, `PUMP_AIR_DUTY=160`.

Slots: 1..12 ingredients; 13 water; 14 trash/air.


### Topic payload examples

Pour (happy path)

App → Device (publish)

```json
"1:2:1,3:1"
```

Device → App (receive)

```json
{ "status": "eta", "seconds": 12 }
```

Device → App (on finish)

```json
{ "status": "success" }
```

Volume updates (as they change)

```json
{ "action": "VOLUME_UPDATED", "slot": 0, "volume": 0.45, "unit": "L" }
```

Pour (glass removed)

```json
{ "status": "error", "message": "Glass Removed - replace glass to continue" }
```

Insufficient ingredients

```json
{ "status": "error", "message": "Insufficient ingredients" }
```

Slot config

```json
// App → Device
{ "action": "GET_CONFIG" }

// Device → App
{ "action": "CURRENT_CONFIG", "slots": [101, 0, 205, 0, 0, 0, 0, 0, 0, 0, 0, 0] }

// Set a slot
{ "action": "SET_SLOT", "slot": 2, "ingredientId": 205 }

// Get volumes (liters)
{ "action": "GET_VOLUMES" }

// Device → App
{ "action": "CURRENT_VOLUMES", "unit": "L", "volumes": [0.75,0.50,0.12,0,0,0,0,0,0,0,0,0] }
```

Maintenance

```json
// Quick clean
{ "action": "QUICK_CLEAN" }

// Device reply (shape may vary)
{ "status": "OK", "action": "QUICK_CLEAN" }
```

Calibration (flow)

```json
// Publish calibration
{ "rates_lps": [0.010, 0.019, 0.027, 0.034, 0.040], "fit": { "type": "log", "a": 0.013, "b": 0.022 } }

// Request current
{ "action": "GET_CALIBRATION" }

// Device → App
{ "action": "CURRENT_CALIBRATION", "rates_lps": [0.010,0.019,0.027,0.034,0.040], "fit": { "type": "log", "a": 0.013, "b": 0.022 } }
```

Heartbeat

```json
// App → Device
{ "action": "HEARTBEAT_CHECK" }

// Device → App
{ "msg": "heartbeat" }
```


### Flow diagrams (ASCII)

Pour lifecycle

```text
IDLE
  │
  ├─ App → publish "<slot:oz[:prio]>,..."
  │
  ├─ Check: not busy? ✔
  ├─ Check: stock sufficient? ✔
  ├─ Wait for cup present (≤30s) ──╮
  │                                │ timeout → error
  ├─ Emit ETA
  ├─ Start pump + route outputs (1&3)
  ├─ Parallel dispense by priority + proportional time‑slicing
  │     └─ if cup removed → pause + flash red → resume on return
  ├─ Finish dispense
  ├─ Post‑clean: water → air (top) → trash drain
  ├─ Persist volumes (liters)
  └─ Emit success → IDLE
```

Quick clean

```text
IDLE → MAINTENANCE
  ├─ Route spout (outlets 1&3), open water (13), close trash (14)
  ├─ Pump forward for QUICK_CLEAN_MS
  ├─ Air purge top (1&4) for CLEAN_AIR_TOP_MS
  ├─ Trash drain (2&4 + 14) for CLEAN_TRASH_MS
  └─ Close all → IDLE
```


## Infrastructure & IoT

| Resource                 | Notes                                                                       |
| ------------------------ | --------------------------------------------------------------------------- |
| **AWS IoT Policy**       | `Amplify-App-Policy` – attached automatically on first launch (`index.tsx`) |
| **CloudFront Image CDN** | `d3jj0su0y4d6lr.cloudfront.net` serves placeholder & generated glass PNGs   |
| **CloudWatch Logs**      | Firmware publishes pour results & slot‑config                               |
| **S3 Static JSON**       | `drinkMenu/drinks.json`, `ingredients.json`, `logs/pourHistory.json`        |

---

## Data Models
![liquorbot-data-models](https://github.com/user-attachments/assets/ccbfac1c-38e9-4a20-aa65-993424684c57)

Key relations:

* **UserProfile** 1‑to‑N **CustomRecipe**
* **Event** owns N `drinkIDs` (built‑in or custom)
* **PouredDrink** records telemetry per pour

---

## Development Workflows

### Mobile App

```bash
npm run lint           # eslint + prettier
npm run test           # jest (unit)
npx expo start         # live reload
```

Pull‑to‑refresh **Explore** section to regenerate recipe books.

### Firmware

```bash
pio run -e esp32dev
pio test               # Unity tests (mock Arduino)
```

### CI/CD Suggestions

* **GitHub Actions** matrix `{ mobile, firmware } × { lint, test, build }`
* OTA pipeline via AWS S3 presigned URLs *(future work)*

---

## Testing

| Level         | Tooling                                              |
| ------------- | ---------------------------------------------------- |
| Unit (JS)     | Jest + @testing-library/react‑native                 |
| E2E (app)     | Detox *(planned)*                                    |
| Firmware unit | Arduino‑CI / PlatformIO `pio test`                   |
| Integration   | Amplify Mock (`amplify mock api`) + MQTT mock broker |

---

## Troubleshooting & FAQ

<details>
<summary>Amplify “API Key not found” error</summary>

Run:

```bash
amplify env pull --appId <appId> --envName dev
```

</details>

<details>
<summary>Device stuck in BUSY state</summary>

Send

```json
{ "action":"EMPTY_SYSTEM" }
```

to the maintenance topic or press the hardware **RESET** button.

</details>

---


## Screenshots

| Home Menu (Make a Drink) | Custom Drink Builder |
|--------------------------|----------------------|
| ![Screenshot 2025-05-19 140325](https://github.com/user-attachments/assets/4e400a36-8118-4af9-ba1d-9751b8d8b91a) | ![Screenshot 2025-05-19 140458](https://github.com/user-attachments/assets/538763ec-dc03-425b-8e23-b067be17e649) |

| Events Manager | Device Settings |
|----------------|-----------------|
| ![Screenshot 2025-05-19 140639](https://github.com/user-attachments/assets/65be14dc-17b5-4e01-a45f-5a47085dfee5) | ![Screenshot 2025-05-19 140709](https://github.com/user-attachments/assets/e52fe967-8808-45c6-b92d-33d2ca8ae2bd) |

> 📸 All screenshots captured from the Android Studio Emulator.

---

*Enjoy your perfectly poured cocktails!* 🥂

