// -----------------------------------------------------------------------------
// File: session-loading.tsx
// Purpose: One-time splash that force-refreshes the ID token, caches the
//          Cognito groups, then jumps to the main tab stack.
// -----------------------------------------------------------------------------
import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { fetchAuthSession } from '@aws-amplify/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SessionLoading() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const session = await fetchAuthSession({ forceRefresh: true });
        const raw     = session.tokens?.idToken?.payload['cognito:groups'] ?? [];
        const groups  = Array.isArray(raw) ? raw.filter((g): g is string => typeof g === 'string') : [];
        await AsyncStorage.setItem('userGroups', JSON.stringify(groups));
      } catch (err) {
        console.warn('session-loading:', err);
      } finally {
        router.replace('/(tabs)');
      }
    })();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#CE975E" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },
});
