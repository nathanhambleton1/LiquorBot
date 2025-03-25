// app/_layout.tsx
import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { withAuthenticator } from '@aws-amplify/ui-react-native';
import { Amplify } from 'aws-amplify';
import config from '../src/amplifyconfiguration.json';
import { PubSub } from '@aws-amplify/pubsub';
import { fetchAuthSession } from 'aws-amplify/auth';

// Create PubSub instance for AWS IoT
export const pubsub = new PubSub({
    region: 'us-east-1',
    endpoint: 'wss://a2d1p97nzglf1y-ats.iot.us-east-1.amazonaws.com/mqtt'
});

Amplify.configure(config);

function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="drinkDetails" options={{ title: 'Drink Details' }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default withAuthenticator(RootLayout);