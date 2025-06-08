// -----------------------------------------------------------------------------
// File: app/join/[code].tsx
// Catch deep links like myapp://join/ABC123
// Saves the code, then forwards user to the normal app flow.
// -----------------------------------------------------------------------------
import { useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchAuthSession } from '@aws-amplify/auth';

export default function JoinCatch() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const router   = useRouter();

  useEffect(() => {
    const run = async () => {
      if (typeof code === 'string' && code.length) {
        await AsyncStorage.setItem('pendingEventCode', code);
      }
      // Decide where to send the user next
      try {
        await fetchAuthSession();          // signed-in
        router.replace('/(tabs)');         // home tab group
      } catch {
        router.replace('/auth/sign-in');   // not signed-in
      }
    };
    run();
  }, [code]);

  return null;     // Render nothing – instant redirect
}
