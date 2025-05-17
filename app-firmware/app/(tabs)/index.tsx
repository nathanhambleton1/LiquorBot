// -----------------------------------------------------------------------------
// File: index.tsx
// Description: Main home screen for the LiquorBot app. Displays connection
//              status, navigation options, and auto‑attaches the IoT policy
//              after the user’s Cognito Identity‑ID is created.
// Author: Nathan Hambleton
// Updated: 15 May 2025  (static SDK import – no tsconfig tweaks needed)
// -----------------------------------------------------------------------------
import React, { useRef, useEffect } from 'react';
import {
  StyleSheet,
  ImageBackground,
  Text,
  View,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useLiquorBot }     from '../components/liquorbot-provider';
import { fetchAuthSession } from '@aws-amplify/auth';

/* ---------- AWS IoT SDK (static import) ---------- */
import {
  IoTClient,
  AttachPolicyCommand,
  ListAttachedPoliciesCommand,
} from '@aws-sdk/client-iot';

/* ───────────────────────── constants ───────────────────────── */
const REGION      = 'us-east-1';          // update if you deploy elsewhere
const POLICY_NAME = 'Amplify-App-Policy'; // must match the console

export default function Index() {
  const router        = useRouter();
  const glowAnimation = useRef(new Animated.Value(1)).current;

  /* LiquorBot connectivity (UI only) */
  const { isConnected, liquorbotId } = useLiquorBot();

  /* Ensure we attempt the attach only once per app‑launch */
  const attemptedAttach = useRef(false);

  useEffect(() => {
    /* ---------- glow animation ---------- */
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnimation, { toValue: 1.2, duration: 800, useNativeDriver: true }),
        Animated.timing(glowAnimation, { toValue: 1,   duration: 800, useNativeDriver: true }),
      ]),
    ).start();

    /* ---------- IoT‑policy auto‑attach ---------- */
    if (!attemptedAttach.current) {
      attemptedAttach.current = true;

      (async () => {
        try {
          /* 1 · get Identity‑ID + temporary AWS creds */
          const { identityId, credentials } = await fetchAuthSession();
          console.log('Cognito Identity ID:', identityId);

          /* 2 · create IoT client signed with these creds */
          const iot = new IoTClient({ region: REGION, credentials });

          /* 3 · skip if policy already attached */
          const { policies = [] } = await iot.send(
            new ListAttachedPoliciesCommand({ target: identityId }),
          );
          const already = policies.some(p => p.policyName === POLICY_NAME);
          if (already) return;

          /* 4 · attach the policy */
          await iot.send(
            new AttachPolicyCommand({ policyName: POLICY_NAME, target: identityId }),
          );
          console.log('✔ IoT policy attached to', identityId);
        } catch (err: any) {
          /* Ignore “already exists”, warn on anything else */
          if (err?.name !== 'ResourceAlreadyExistsException') {
            console.warn('⚠ IoT policy attach failed:', err);
          }
        }
      })();
    }
  }, []); // run once

  /* ───────────────────────── UI ───────────────────────── */
  return (
    <ImageBackground
      source={require('@/assets/images/home-background.jpg')}
      style={styles.background}
      resizeMode="cover"
    >
      {/* chip‑icon shortcut to Device Settings */}
      <View style={styles.wifiIconContainer}>
        <TouchableOpacity onPress={() => router.push('/device-settings')}>
          <Ionicons name="hardware-chip" size={36} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.overlay}>
        <Text style={styles.title}>LiquorBot</Text>

        {/* connection status */}
        <View style={styles.connectionRow}>
          <Animated.View
            style={[
              styles.dot,
              {
                backgroundColor: isConnected ? '#63d44a' : '#B81A1A',
                transform:       [{ scale: glowAnimation }],
                shadowColor:     isConnected ? '#00FF00' : '#B81A1A',
                shadowOpacity:   glowAnimation.interpolate({
                  inputRange: [1, 1.2],
                  outputRange: [0.3, 0.8],
                }),
              },
            ]}
          />
          <Text style={styles.connectionText}>
            {isConnected
              ? `Connected to LiquorBot #${liquorbotId}`
              : `LiquorBot #${liquorbotId} Disconnected`}
          </Text>
        </View>
      </View>

      {/* navigate to events */}
      <TouchableOpacity
        style={styles.eventsButton}
        onPress={() => router.push('/events')}
      >
        <Text style={styles.eventsButtonText}>Manage Events</Text>
        <Ionicons
          name="calendar"
          size={20}
          color="#141414"
          style={styles.arrowIcon}
        />
      </TouchableOpacity>

      {/* navigate to menu */}
      <TouchableOpacity
        style={styles.menuButton}
        onPress={() => router.push('/menu')}
      >
        <Text style={styles.menuButtonText}>Explore Drinks</Text>
        <Ionicons
          name="chevron-forward"
          size={20}
          color="#141414"
          style={styles.arrowIcon}
        />
      </TouchableOpacity>
    </ImageBackground>
  );
}

/* ───────────────────────── styles ───────────────────────── */
const styles = StyleSheet.create({
  background:   { flex: 1, justifyContent: 'center', alignItems: 'center' },
  overlay:      { position: 'absolute', top: 100, width: '100%', paddingLeft: 20 },
  title:        { fontSize: 48, color: '#DFDCD9', fontWeight: 'bold' },
  connectionRow:{ flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  dot: {
    width: 8, height: 8, borderRadius: 5, marginRight: 8,
    shadowOffset: { width: 0, height: 0 }, shadowRadius: 5,
    shadowOpacity: 0.6, elevation: 5,
  },
  connectionText:{ fontSize: 18, color: '#4F4F4F' },
  menuButton: {
    position: 'absolute', bottom: 130, alignSelf: 'center',
    backgroundColor: '#CE975E', paddingVertical: 16, paddingHorizontal: 26,
    borderRadius: 10, flexDirection: 'row', alignItems: 'center',
  },
  menuButtonText:{ color: '#141414', fontSize: 20, fontWeight: 'bold', marginRight: 8 },
  arrowIcon:    { marginLeft: 5 },
  wifiIconContainer:{ position: 'absolute', top: 115, right: 40, zIndex: 10 },
  eventsButton: {
    position: 'absolute', bottom: 200, alignSelf: 'center',
    backgroundColor: '#CE975E', paddingVertical: 16, paddingHorizontal: 26,
    borderRadius: 10, flexDirection: 'row', alignItems: 'center',
  },
  eventsButtonText: { color: '#141414', fontSize: 20, fontWeight: 'bold', marginRight: 8 },
});
