import React from 'react';
import { Stack } from 'expo-router';
import { Amplify } from 'aws-amplify';
import config from '../src/amplifyconfiguration.json';

// 1) Import from Amplify UI
import { Authenticator } from '@aws-amplify/ui-react-native';

// Optionally, if you use PubSub:
import { PubSub } from '@aws-amplify/pubsub';
export const pubsub = new PubSub({
  region: 'us-east-1',
  endpoint: 'wss://a2d1p97nzglf1y-ats.iot.us-east-1.amazonaws.com/mqtt'
});

Amplify.configure(config);

export default function RootLayout() {
  return (
    // 2) Wrap your layout with Authenticator.Provider
    <Authenticator.Provider>
      <Stack
        screenOptions={{
          headerShown: false, // Ensure no headers are shown globally
        }}
      >
        {/* Define your app's main routes */}
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth" />
      </Stack>
    </Authenticator.Provider>
  );
}
