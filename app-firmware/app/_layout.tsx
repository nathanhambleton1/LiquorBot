// -----------------------------------------------------------------------------
// File: _layout.tsx (app)
// Description: Root layout for the LiquorBot app. Configures AWS Amplify, 
//              PubSub, and wraps the app with authentication and LiquorBot 
//              context providers.
// Author: Nathan Hambleton
// Created:  March 1, 2025
// -----------------------------------------------------------------------------
import React from 'react';
import { Stack } from 'expo-router';
import { Amplify } from 'aws-amplify';
import config from '../src/amplifyconfiguration.json';
import { StatusBar } from 'expo-status-bar';
import { UnitsProvider } from './components/UnitsContext';
// Auth wrapper
import { Authenticator } from '@aws-amplify/ui-react-native';

// PubSub setup
import { PubSub } from '@aws-amplify/pubsub';
export const pubsub = new PubSub({
  region: 'us-east-1',
  endpoint: 'wss://a2d1p97nzglf1y-ats.iot.us-east-1.amazonaws.com/mqtt'
});

// Amplify setup
Amplify.configure(config);

// 👇 ADD THIS: import the LiquorBotProvider
import { LiquorBotProvider } from './components/liquorbot-provider';

export default function RootLayout() {
  return (
    <Authenticator.Provider>
      {/* 👇 WRAP everything inside LiquorBotProvider and UnitsProvider */}
      <LiquorBotProvider>
        <UnitsProvider>
          {/* Force white (light-content) status-bar icons everywhere */}
          <StatusBar style="light" translucent />
          <Stack
            screenOptions={{ headerShown: false }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="auth" />
          </Stack>
        </UnitsProvider>
      </LiquorBotProvider>
    </Authenticator.Provider>
  );
}
