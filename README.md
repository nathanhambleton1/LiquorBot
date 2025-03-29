# Liquor Bot

## Overview
The Liquor Bot Control App is a mobile application built with React Native, designed to control a cocktail-making robot. The robot pours drinks using a system of solenoids and pumps, all managed through an ESP32-S3 microcontroller. This project aims to provide seamless drink ordering and mixing for events, bars, and home use.

## Features
- **User Management**: Secure user accounts, roles (admin, bartender, guest) managed by AWS Amplify.
- **Robot Control**: Real-time control of solenoids and pumps via MQTT requests through AWS IoT Core.
- **Recipe Management**: Create, browse, and customize drink recipes.
- **Order System**: Queue and track drink orders from multiple users.
- **Analytics**: Track popular drinks, ingredient usage, and machine status.

## Server Components
### Data Management
- **User Data**: Account information managed by AWS Amplify and stored on AWS servers.
- **Robot Configuration**: Solenoid and pump mapping, calibration settings.
- **Drink Recipes**: Predefined and user-generated recipes.
- **Order History**: Records of all drink orders and statuses.
- **Logs**: System logs, error handling, usage analytics.

### Networking
- **API**: RESTful API for communication with the robot and the app.
- **MQTT**: Real-time communication with the robot via AWS IoT Core.
- **Bluetooth**: Direct connection to the robot for remote locations.

## Setup
### Prerequisites
- ESP32 Microcontroller with the latest firmware.
- Bluetooth-enabled mobile device (iOS or Android).
- Node.js and npm installed on your system.
- AWS Amplify account configured for user management and MQTT communication.

### Installation
1. **Create a New Blank Expo App**  
   Install Node.js if not already installed. Verify installation:
   ```bash
   node -v
   npm -v
   ```
   Create a new Expo app:
   ```bash
   npx create-expo-app liquor-bot-control-app
   ```
   Choose a blank template (JavaScript or TypeScript). Navigate to the project directory:
   ```bash
   cd liquor-bot-control-app
   ```
   Start the project to verify it works:
   ```bash
   npx expo run:android
   ```

2. **Set Up Your Amplify Backend**  
   Install the Amplify CLI globally:
   ```bash
   npm install -g @aws-amplify/cli
   ```
   Initialize your Amplify project:
   ```bash
   amplify init
   ```
   - Choose **Gen 1** when prompted.
   - Authenticate using AWS access keys (create an IAM user in AWS with Amplify permissions).
   - Select your AWS region.

   After initialization, you should see the app in the AWS Amplify console.

3. **Install Required Libraries**  
   Install the necessary dependencies:
   ```bash
   npm install aws-amplify @aws-amplify/react-native @react-native-community/netinfo @react-native-async-storage/async-storage react-native-get-random-values
   ```
   If you encounter issues, install them individually:
   ```bash
   npm install aws-amplify
   npm install @aws-amplify/react-native
   npm install @react-native-community/netinfo
   npm install @react-native-async-storage/async-storage
   npm install react-native-get-random-values
   ```

4. **Configure Amplify in Your App**  
   In your app’s entry file (e.g., `app/_layout.tsx`), import and configure Amplify:
   ```javascript
   import 'react-native-get-random-values';
   import { Amplify } from 'aws-amplify';
   import amplifyconfig from '../src/amplifyconfiguration.json';

   Amplify.configure(amplifyconfig);
   ```
   Note: The `amplifyconfiguration.json` file is automatically generated after running `amplify push`.

5. **Start the Server**  
   Configure environment variables in a `.env` file:
   ```
   PORT=3000
   DB_URI=your_database_uri
   AWS_REGION=your_aws_region
   AWS_IOT_ENDPOINT=your_mqtt_endpoint
   ```
   Start the server:
   ```bash
   npm start
   ```

### Connect API and Database to the App
1. **Add a GraphQL API and Database**  
   Add a GraphQL API to your app and automatically provision a database:
   ```bash
   amplify add api
   ```
   Accept the default values:
   - Select **GraphQL** as the service.
   - Choose **Single object with fields** as the schema template.

   The CLI will generate a schema file (e.g., `amplify/backend/api/your-api-name/schema.graphql`) with a default `Todo` model:
   ```graphql
   type Todo @model {
     id: ID!
     name: String!
     description: String
   }
   ```

2. **Deploy the API**  
   Deploy the API and database:
   ```bash
   amplify push
   ```
   During the prompts:
   - Choose **Yes** to generate code for the GraphQL API.
   - Select **TypeScript** as the language.
   - Use the default file name patterns for queries, mutations, and subscriptions.
   - Accept the default maximum statement depth.

   After deployment, the API will be live, and you can start interacting with it.

3. **Generate GraphQL Operations**  
   The Amplify CLI will generate GraphQL operations (queries, mutations, and subscriptions) in the `src/graphql` directory. These can be used to interact with the API in your app.

### Add Authentication
1. **Create Authentication Service**  
   To add authentication to your app, run this command:
   ```bash
   amplify add auth
   ```
   Select the defaults for the following prompts:
   - **Do you want to use the default authentication and security configuration?** Default configuration.
   - **How do you want users to be able to sign in?** Username.
   - **Do you want to configure advanced settings?** No, I am done.

   Deploy the authentication service:
   ```bash
   amplify push
   ```
   To view the deployed services in your project at any time, run:
   ```bash
   amplify console
   ```

2. **Create Login UI**  
   Install Amplify UI components for React Native:
   ```bash
   expo install @aws-amplify/ui-react-native react-native-safe-area-context@^4.2.5
   ```
   Use the `Authenticator` component from Amplify UI to quickly add a login flow to your app. Refer to the [Amplify UI documentation](https://ui.docs.amplify.aws/) for more details.

### Set Up Amplify PubSub
1. **Install PubSub**  
   Ensure the `@aws-amplify/pubsub` package matches the version of `aws-amplify` in your `package.json`. Import PubSub into your app:
   ```javascript
   import { Amplify } from 'aws-amplify';
   import { PubSub } from '@aws-amplify/pubsub';
   ```

2. **Configure PubSub**  
   Create a new instance for your endpoint and region:
   ```javascript
   const pubsub = new PubSub({
     region: '<YOUR-IOT-REGION>',
     endpoint: 'wss://xxxxxxxxxxxxx.iot.<YOUR-IOT-REGION>.amazonaws.com/mqtt',
   });
   ```

3. **Set Up IAM Policies**  
   - Go to AWS IoT Core > Security > Policies and create a policy (e.g., `myIoTPolicy`) with full access to all topics.
   - Attach the policy to your Amazon Cognito Identity using:
     ```bash
     aws iot attach-policy --policy-name 'myIoTPolicy' --target '<YOUR_COGNITO_IDENTITY_ID>'
     ```

4. **Update Cognito Authenticated Role**  
   Attach `AWSIoTDataAccess` and `AWSIoTConfigAccess` policies to the Cognito Authenticated Role in the AWS Console.

5. **Use PubSub in Your App**  
   Example usage:
   ```javascript
   pubsub.subscribe({ topics: ['messages'] }).subscribe({
     next: (data) => console.log('Message received:', data),
   });

   pubsub.publish({ topic: 'messages', msg: 'Hello, world!' });
   ```

## Usage
- **Mobile App**: Install the React Native app on your mobile device and connect to the robot via Bluetooth or AWS IoT Core using MQTT.

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