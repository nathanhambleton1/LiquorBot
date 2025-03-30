// app/auth/_layout.tsx
import React from 'react';
import { Stack, Redirect } from 'expo-router';
import { useAuthenticator } from '@aws-amplify/ui-react-native';

export default function AuthLayout() {
  // Grab Auth status from Amplify UI’s hook
  const { authStatus } = useAuthenticator((context) => [context.authStatus]);

  // If we’re already authenticated, go straight to tabs
  if (authStatus === 'authenticated') {
    return <Redirect href="/(tabs)" />;
  }

  // Otherwise, render whatever is inside `app/auth/`
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* This ensures we can navigate to sign-in or future sign-up, etc. */}
      <Stack.Screen name="sign-in" />
      {/* If you add sign-up or confirm-code later, they go here as well */}
    </Stack>
  );
}
