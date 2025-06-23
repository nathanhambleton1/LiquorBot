// -----------------------------------------------------------------------------
// File: _layout.tsx (app)
// Description: Root layout for the LiquorBot app. Configures AWS Amplify, 
//              PubSub, and wraps the app with authentication and LiquorBot 
//              context providers.
// Author: Nathan Hambleton
// Created:  March 1, 2025
// -----------------------------------------------------------------------------
import React, { useContext, useEffect } from 'react';
import { Stack } from 'expo-router';
import { Amplify } from 'aws-amplify';
import config from '../src/amplifyconfiguration.json';
import { StatusBar } from 'expo-status-bar';
import { UnitsProvider } from './components/UnitsContext';
import { DeepLinkProvider }   from './components/deep-link-provider';
import { Authenticator } from '@aws-amplify/ui-react-native';
import { AuthModalContext } from './components/AuthModalContext';

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
import SessionLoadingOnStart from './components/SessionLoadingOnStart';

export default function RootLayout() {
  // Show session loading on cold start
  const authModal = useContext(AuthModalContext);
  useEffect(() => {
    if (authModal?.open) {
      authModal.open('sessionLoading', { modalMode: true });
    }
    // Only run on cold start (mount)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Authenticator.Provider>
      <DeepLinkProvider>
        <LiquorBotProvider>
          <UnitsProvider>
            <AuthModalProvider>
              <StatusBar style="light" translucent />
              <SessionLoadingOnStart />
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
