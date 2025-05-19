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
cd firmware
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
cd firmware
cp include/secrets_template.h include/secrets.h   # fill in certs & keys
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

---

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

## Roadmap

* ✅ Custom recipe editing & S3 image upload
* ✅ Non‑blocking FreeRTOS pour task
* 🔜 IOS App Test
* 🔜 Push notifications when pours complete
* 🔜 OTA firmware updates via Amplify Storage
* 🔜 Web dashboard (Next.js SSR with Amplify)

---

## License

**MIT** © Nathan Hambleton & contributors — see [`LICENSE`](LICENSE).

---

*Enjoy your perfectly poured cocktails!* 🥂

