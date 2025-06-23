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
import { DeepLinkProvider }   from './components/deep-link-provider';
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
import { AuthModalProvider } from './components/AuthModalContext';
import AuthModal from './components/AuthModal';

export default function RootLayout() {
  return (
    <Authenticator.Provider>
      <DeepLinkProvider>
        <LiquorBotProvider>
          <UnitsProvider>
            <AuthModalProvider>
              <StatusBar style="light" translucent />
              <AuthModal />
              <Stack
                screenOptions={{ headerShown: false }}
              >
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="auth" />
              </Stack>
            </AuthModalProvider>
          </UnitsProvider>
        </LiquorBotProvider>
      </DeepLinkProvider>
    </Authenticator.Provider>
  );
}
