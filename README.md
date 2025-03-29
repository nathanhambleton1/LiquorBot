# Liquor Bot

## Overview
The Liquor Bot Control App is a mobile application built with React Native, designed to control a cocktail-making robot. The robot pours drinks using a system of solenoids and pumps, all managed through an ESP32-S3 microcontroller. This project aims to provide seamless drink ordering and mixing for events, bars, and home use.

## Features
- **User Management**: Secure user accounts, roles (admin, bartender, guest).
- **Robot Control**: Real-time control of solenoids and pumps via Bluetooth or Wi-Fi.
- **Recipe Management**: Create, browse, and customize drink recipes.
- **Order System**: Queue and track drink orders from multiple users.
- **Analytics**: Track popular drinks, ingredient usage, and machine status.
- **POS Integration**: Optional integration with restaurant POS systems.

## Server Components
### Data Management
- **User Data**: Account information, authentication tokens.
- **Robot Configuration**: Solenoid and pump mapping, calibration settings.
- **Drink Recipes**: Predefined and user-generated recipes.
- **Order History**: Records of all drink orders and statuses.
- **Logs**: System logs, error handling, usage analytics.

### Networking
- **API**: RESTful API for communication with the robot and the app.
- **WebSocket**: Real-time updates for order status and robot control.
- **Bluetooth**: Direct connection to the robot for remote locations.

## Setup
### Prerequisites
- ESP32 Microcontroller with the latest firmware.
- Bluetooth-enabled mobile device (iOS or Android).
- Node.js and npm for server setup.
- Database (e.g., MongoDB, PostgreSQL).

### Installation
1. Clone the repository:
    ```bash
    git clone https://github.com/nathanhambleton1/liquor-bot-control-app.git
    ```
2. Navigate to the project directory:
    ```bash
    cd liquor-bot-control-app
    ```
3. Install dependencies:
    ```bash
    npm install
    ```
4. Configure environment variables in `.env` file:
    ```
    PORT=3000
    DB_URI=your_database_uri
    ```
5. Start the server:
    ```bash
    npm start
    ```

## Usage
- **Mobile App**: Install the React Native app on your mobile device and connect to the robot via Bluetooth.

## Contributing
1. Fork the repository.
2. Create a feature branch:
    ```bash
    git checkout -b feature/your-feature-name
    ```
3. Commit your changes:
    ```bash
    git commit -m "Add your feature"
    ```
4. Push to the branch:
    ```bash
    git push origin feature/your-feature-name
    ```
5. Open a Pull Request.

## License
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contact
For questions or support, please contact us at nhambleton03@gmail.com.
