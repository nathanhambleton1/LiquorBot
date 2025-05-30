// -----------------------------------------------------------------------------
// File: index.tsx
// Description: Main home screen for the LiquorBot app. Displays connection
//              status, navigation options, and auto‑attaches the IoT policy
//              after the user’s Cognito Identity‑ID is created.
// Author: Nathan Hambleton
// Updated: 15 May 2025  (static SDK import – no tsconfig tweaks needed)
// -----------------------------------------------------------------------------
import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  ImageBackground,
  Text,
  View,
  Animated,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLiquorBot }     from '../components/liquorbot-provider';
import { fetchAuthSession } from '@aws-amplify/auth';
import { generateClient } from 'aws-amplify/api';
import { listEvents } from '../../src/graphql/queries';
import { Asset } from 'expo-asset';

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
  const { isConnected, liquorbotId, reconnect, isAdmin } = useLiquorBot();

  /* Ensure we attempt the attach only once per app‑launch */
  const attemptedAttach = useRef(false);

  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  interface Event {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
  }

  const [currentUser, setCurrentUser] = useState<string | null>(null);

  /* ──────────────────────── fetch events ──────────────────────── */
  useEffect(() => {
  /* grab the Cognito username first */
    (async () => {
      try {
        const ses = await fetchAuthSession();
        const u   = ses.tokens?.idToken?.payload['cognito:username'];
        setCurrentUser(typeof u === 'string' ? u : null);
      } catch { setCurrentUser(null); }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await Asset.loadAsync(require('@/assets/images/home-background.jpg'));
      } catch (error) {
        console.warn('Error preloading image:', error);
      }
    })();
  }, []);


  const fetchEvents = useCallback(async () => {
    if (!currentUser) return; // Removed liquorbotId check

    try {
      const { data } = await generateClient().graphql({
        query: listEvents,
        variables: {
          filter: {
            or: [ // Removed liquorbotId filter
              { owner:       { eq: currentUser } },
              { guestOwners: { contains: currentUser } },
            ],
          },
        },
        authMode: 'userPool',
      });

      const now = new Date();
      const filtered = data.listEvents.items
        .map((item: any) => ({
          id: item.id,
          name: item.name,
          startTime: item.startTime,
          endTime: item.endTime,
        }))
        .filter((event: Event) => new Date(event.endTime) > now)
        .sort((a: Event, b: Event) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        );

      setUpcomingEvents(filtered);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setEventsLoading(false);
    }
  }, [currentUser]);

  // Run once currentUser is available
  useEffect(() => {
    if (currentUser && liquorbotId) {
      fetchEvents();
    }
  }, [currentUser, liquorbotId]);

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

          // Force credentials refresh and reconnect
          await fetchAuthSession({ forceRefresh: true });
          reconnect(); // Trigger reconnection
        } catch (err: any) {
          /* Ignore “already exists”, warn on anything else */
          if (err?.name !== 'ResourceAlreadyExistsException') {
            console.warn('⚠ IoT policy attach failed:', err);
          }
        }
      })();
    }
  }, []); // run once

  if (eventsLoading) {
    return (
      <View style={[styles.background, { backgroundColor: '#1F1F1F' }]} />
    );
  }

  /* ───────────────────────── UI ───────────────────────── */
  return (
    <ImageBackground
      source={require('@/assets/images/home-background.jpg')}
      style={[styles.background, { backgroundColor: '#1F1F1F' }, ]}
      resizeMode="cover"
    >
      {/* Device-Settings button — ADMIN only */}
      {isAdmin && (
        <View style={styles.wifiIconContainer}>
          <TouchableOpacity onPress={() => router.push('/device-settings')}>
            <Ionicons name="hardware-chip" size={36} color="#DFDCD9" />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.overlay}>
        <Text style={styles.title}>LiquorBot</Text>

        {/* connection status */}
        <View style={styles.connectionRow}>
          <Animated.View
            style={[
              styles.dot,
              {
                backgroundColor: isConnected ? '#63d44a' : '#B81A1A',
                transform: [{ scale: glowAnimation }],
                shadowColor: isConnected ? '#00FF00' : '#B81A1A',
                shadowOpacity: glowAnimation.interpolate({
                  inputRange: [1, 1.2],
                  outputRange: [0.3, 0.8],
                }),
              },
            ]}
          />
          <Text style={styles.connectionText}>
            {isConnected ? 'LiquorBot Connected' : 'LiquorBot Disconnected'}
          </Text>
        </View>
      </View>

      {/* Updated Button Grid Container */}
      <View style={styles.buttonGrid}>
        {/* Main Event Tile */}
        <TouchableOpacity 
          style={styles.mainTile}
          onPress={() => router.push('./events')}
        >
          <View style={styles.mainTileContent}>
            <View style={styles.mainIconTextContainer}>
              <View style={styles.mainIconContainer}>
                <Ionicons name="calendar" size={32} color="#DFDCD9" />
              </View>
              <View style={styles.mainTextContainer}>
                <Text style={styles.mainTileTitle}>Events</Text>
                <Text style={styles.mainTileSubtext}>Upcoming Events</Text>
              </View>
            </View>

            {eventsLoading ? (
              <ActivityIndicator color="#DFDCD9" style={styles.eventsLoader} />
            ) : upcomingEvents.length === 0 ? (
              <Text style={styles.noEventsText}>No upcoming events</Text>
            ) : (
                <ScrollView 
                contentContainerStyle={styles.eventsContainer}
                showsVerticalScrollIndicator={false}
                >
                {upcomingEvents.slice(0, 3).map((event: Event) => (
                  <View key={event.id} style={styles.eventItem}>
                    <View style={styles.eventRow}>
                      <Text style={styles.eventDate}>
                        {new Date(event.startTime).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Text>
                      <Text 
                        numberOfLines={1} 
                        ellipsizeMode="tail" 
                        style={styles.eventTitle}
                      >
                        {event.name}
                      </Text>
                    </View>
                  </View>
                ))}
                </ScrollView>
            )}
          </View>
          <View style={styles.glowOverlay} />
        </TouchableOpacity>


        {/* Right Column Tiles */}
        <View style={styles.rightColumn}>
          <TouchableOpacity
            style={styles.smallTile}
            onPress={() => router.push('/menu')}
          >
            <View style={styles.iconTextContainer}>
              <View style={styles.iconContainer}>
                <Ionicons name="wine" size={28} color="#DFDCD9" />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.tileTitle}>Drink Menu</Text>
                <Text style={styles.tileSubtext}>Explore Recipes</Text>
              </View>
            </View>
            <View style={styles.glowOverlay} />
          </TouchableOpacity>

          {/* Conditional Button */}
        {isAdmin ? (
          // Admin - New Event Button
          <TouchableOpacity
            style={styles.smallTile}
            onPress={() => router.push('/create-event')}
          >
            <View style={styles.iconTextContainer}>
              <View style={styles.iconContainer}>
                <Ionicons name="add-circle" size={28} color="#DFDCD9" />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.tileTitle}>New Event</Text>
                <Text style={styles.tileSubtext}>Start Planning</Text>
              </View>
            </View>
            <View style={styles.glowOverlay} />
          </TouchableOpacity>
        ) : (
          // Non-Admin - Join Event Button
          <TouchableOpacity
            style={styles.smallTile}
            onPress={() => router.push('/events?join=true')}
          >
            <View style={styles.iconTextContainer}>
              <View style={styles.iconContainer}>
                <Ionicons name="add-circle" size={28} color="#DFDCD9" />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.tileTitle}>Join Event</Text>
                <Text style={styles.tileSubtext}>Enter Invite Code</Text>
              </View>
            </View>
            <View style={styles.glowOverlay} />
          </TouchableOpacity>
        )}
        </View>
      </View>
    </ImageBackground>
  );
}

/* ───────────────────────── styles ───────────────────────── */
const styles = StyleSheet.create({
  eventItem: { marginBottom: 4, width: '100%' },
  eventRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eventDate: { color: 'rgba(223, 220, 217, 0.7)', fontSize: 12, fontWeight: '500', marginRight: 12, minWidth: 40 },
  eventTitle: { color: '#DFDCD9', fontSize: 14, fontWeight: '500', flex: 1 },
  eventsLoader: { marginVertical: 10 },
  noEventsText: { color: 'rgba(223, 220, 217, 0.7)', fontSize: 14, marginVertical: 30 },
  eventsContainer: { flexGrow: 1, paddingVertical: 8 },
  mainTile: { flex: 1, backgroundColor: 'rgba(31, 31, 31, 0.1)', borderRadius: 20, padding: 16, marginRight: 12, overflow: 'hidden' },
  mainTileContent: { flex: 1, justifyContent: 'space-between' },
  mainIconTextContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 0 },
  mainIconContainer: { justifyContent: 'center', marginRight: 8, height: 32 },
  mainTextContainer: { justifyContent: 'space-between', height: 36 },
  mainTileTitle: { color: '#DFDCD9', fontSize: 16, fontWeight: '600', lineHeight: 20 },
  mainTileSubtext: { color: 'rgba(223, 220, 217, 0.9)', fontSize: 12, fontWeight: '300', lineHeight: 16 },
  buttonGrid: { position: 'absolute', bottom: 120, flexDirection: 'row', justifyContent: 'space-between', width: '90%', height: 140 },
  rightColumn: { width: '48%', height: '100%', justifyContent: 'space-between' },
  smallTile: { height: '48%', backgroundColor: 'rgba(31, 31, 31, 0.1)', borderRadius: 16, padding: 12, overflow: 'hidden' },
  iconTextContainer: { flexDirection: 'row', alignItems: 'center', height: '100%' },
  iconContainer: { justifyContent: 'center', marginRight: 12, height: 28 },
  textContainer: { justifyContent: 'space-between', height: 28 },
  tileTitle: { color: '#DFDCD9', fontSize: 16, fontWeight: '600', lineHeight: 18 },
  tileSubtext: { color: 'rgba(223, 220, 217, 0.8)', fontSize: 12, fontWeight: '300', lineHeight: 14 },
  glowOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255, 255, 255, 0.05)' },
  background: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1F1F1F' },
  overlay: { position: 'absolute', top: 100, width: '100%', paddingLeft: 20 },
  title: { fontSize: 48, color: '#DFDCD9', fontWeight: 'bold' },
  connectionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  dot: { width: 8, height: 8, borderRadius: 5, marginRight: 8, shadowOffset: { width: 0, height: 0 }, shadowRadius: 5, shadowOpacity: 0.6, elevation: 5 },
  connectionText: { fontSize: 18, color: '#4F4F4F' },
  menuButton: { position: 'absolute', bottom: 130, alignSelf: 'center', backgroundColor: '#CE975E', paddingVertical: 16, paddingHorizontal: 26, borderRadius: 10, flexDirection: 'row', alignItems: 'center' },
  menuButtonText: { color: '#141414', fontSize: 20, fontWeight: 'bold', marginRight: 8 },
  arrowIcon: { marginLeft: 5 },
  wifiIconContainer: { position: 'absolute', top: 115, right: 40, zIndex: 10 },
  eventsButton: { position: 'absolute', bottom: 200, alignSelf: 'center', backgroundColor: '#CE975E', paddingVertical: 16, paddingHorizontal: 26, borderRadius: 10, flexDirection: 'row', alignItems: 'center' },
  eventsButtonText: { color: '#141414', fontSize: 20, fontWeight: 'bold', marginRight: 8 },
});

