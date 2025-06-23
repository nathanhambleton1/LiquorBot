// -----------------------------------------------------------------------------
// File: index.tsx
// Description: Main home screen for the LiquorBot app. Displays connection
//              status, navigation options, and auto-attaches the IoT policy
//              after the user’s Cognito Identity-ID is created.
// Author: Nathan Hambleton
// Updated: 31 May 2025 – fixed currentUser TDZ errors
// -----------------------------------------------------------------------------
import React, { useRef, useEffect, useState, useCallback, useContext } from 'react';
import {
  StyleSheet,
  ImageBackground,
  Text,
  View,
  Animated,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLiquorBot }     from '../components/liquorbot-provider';
import { fetchAuthSession } from '@aws-amplify/auth';
import { generateClient }   from 'aws-amplify/api';
import { listEvents }       from '../../src/graphql/queries';
import { Asset }            from 'expo-asset';
import { Hub }              from 'aws-amplify/utils';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { DeepLinkContext } from '../components/deep-link-provider';
import { eventsByCode }   from '../../src/graphql/queries';
import { joinEvent }      from '../../src/graphql/mutations';
import { AuthModalContext } from '../components/AuthModalContext';

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
  const navigation = useNavigation();
  const glowAnimation = useRef(new Animated.Value(1)).current;
  const authModal = useContext(AuthModalContext);

  /* LiquorBot connectivity (UI only) */
  const { isConnected, liquorbotId, reconnect, isAdmin } = useLiquorBot();

  /* Ensure we attempt the attach only once per app-launch */
  const attemptedAttach = useRef(false);

  /* -------------------- state -------------------- */
  const [currentUser,    setCurrentUser]    = useState<string | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [eventsLoading,  setEventsLoading]  = useState(true);

  /* ---------- deep-link join popup ---------- */
  const { pendingCode } = useContext(DeepLinkContext);
  const [linkEvent,         setLinkEvent]         = useState<Event|null>(null);
  const [linkModalVisible,  setLinkModalVisible]  = useState(false);
  const [linkLoading,       setLinkLoading]       = useState(false);
  const [linkErr,           setLinkErr]           = useState<string|null>(null);

  /* -------------------- types -------------------- */
  interface Event {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
  }

  // ------------------------------------------------------------------
  // 1.  Keep currentUser in sync with auth state, and clear UI on log-out
  // ------------------------------------------------------------------
  useEffect(() => {
    const readUser = async () => {
      try {
        const ses = await fetchAuthSession();
        const u   = ses.tokens?.idToken?.payload['cognito:username'];
        setCurrentUser(typeof u === 'string' ? u : null);
      } catch {
        setCurrentUser(null);
      }
    };

    // initial read
    readUser();

    // react to auth hub events
    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      if (['signedIn', 'signedOut', 'tokenRefresh'].includes(payload.event)) {
        readUser();
        setUpcomingEvents([]);   // wipe old user’s events instantly
      }
    });
    return () => unsubscribe();
  }, []);

  // If currentUser becomes null for any reason, be sure list is empty
  useEffect(() => {
    if (!currentUser) setUpcomingEvents([]);
  }, [currentUser]);

  /* ───────── deep-link: fetch event & open popup ───────── */
  useEffect(() => {
    if (!pendingCode || !currentUser) return;

    (async () => {
      try {
        const { data } = await generateClient().graphql({
          query: eventsByCode,
          variables: { inviteCode: pendingCode },
          authMode:  'userPool',
        }) as { data: { eventsByCode: { items: any[] } } };

        const ev = data.eventsByCode.items?.[0];
        if (ev) {
          setLinkEvent({
            id:   ev.id,
            name: ev.name,
            startTime: ev.startTime,
            endTime:   ev.endTime,
          });
          setLinkModalVisible(true);
        }
      } catch (e) {
        console.warn('Deep-link lookup failed', e);
      }
    })();
  }, [pendingCode, currentUser]);

  /* ──────────────────────── fetch events ──────────────────────── */
  const fetchEvents = useCallback(async () => {
    let isMounted = true;
    // Double-check currentUser before running
    if (!currentUser) {
      setUpcomingEvents([]);
      setEventsLoading(false);
      return;
    }

    try {
      const { data } = await generateClient().graphql({
        query: listEvents,
        variables: {
          filter: {
            or: [
              { owner:       { eq: currentUser } },
              { guestOwners: { contains: currentUser } },
            ],
          },
        },
        authMode: 'userPool',
      });

      if (!isMounted) return;

      const now = new Date();
      const filtered = data.listEvents.items
        .map((item: any) => ({
          id: item.id,
          name: item.name,
          startTime: item.startTime,
          endTime: item.endTime,
        }))
        .filter((event: Event) => new Date(event.endTime) > now)
        .sort(
          (a: Event, b: Event) =>
            new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        );

      setUpcomingEvents(filtered);
    } catch (error: any) {
      // Only log error if user is still signed in and not a NoSignedUser error
      if (
        currentUser &&
        !(error?.name === 'NoSignedUser' || error?.message?.includes('No current user'))
      ) {
        console.error('Error fetching events:', error);
      }
      // Otherwise, just clear events and loading
      setUpcomingEvents([]);
    } finally {
      setEventsLoading(false);
    }
    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  // Run once currentUser is available
  useEffect(() => {
    if (currentUser && liquorbotId) {
      setEventsLoading(true);          // start loader only when we actually fetch
      fetchEvents();
    } else {
      setUpcomingEvents([]);
      setEventsLoading(false);         // ensure guests don't get stuck
    }
  }, [currentUser, liquorbotId, fetchEvents]);

  // Add useFocusEffect to reload events when page is focused
  useFocusEffect(
    useCallback(() => {
      if (currentUser && liquorbotId) {
        setEventsLoading(true);
        fetchEvents();
      } else {
        setUpcomingEvents([]);
        setEventsLoading(false);
      }
      // No cleanup needed
    }, [currentUser, liquorbotId, fetchEvents])
  );

  /* ---------- preload background ---------- */
  useEffect(() => {
    (async () => {
      try {
        await Asset.loadAsync(require('@/assets/images/home-background.jpg'));
      } catch (error) {
        console.warn('Error preloading image:', error);
      }
    })();
  }, []);

  /* ---------- glow animation & IoT-policy auto-attach ---------- */
  useEffect(() => {
    /* glow */
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnimation, { toValue: 1.2, duration: 800, useNativeDriver: true }),
        Animated.timing(glowAnimation, { toValue: 1,   duration: 800, useNativeDriver: true }),
      ]),
    ).start();

    /* IoT attach (run once) */
    if (!attemptedAttach.current) {
      attemptedAttach.current = true;
      (async () => {
        try {
          /* 1 · get Identity-ID + temporary AWS creds */
          const { identityId, credentials } = await fetchAuthSession();
          console.log('Cognito Identity ID:', identityId);

          /* 2 · create IoT client signed with these creds */
          const iot = new IoTClient({ region: REGION, credentials });

          /* 3 · skip if policy already attached */
          const { policies = [] } = await iot.send(
            new ListAttachedPoliciesCommand({ target: identityId }),
          );
          if (policies.some(p => p.policyName === POLICY_NAME)) return;

          /* 4 · attach the policy */
          await iot.send(
            new AttachPolicyCommand({ policyName: POLICY_NAME, target: identityId }),
          );
          console.log('✔ IoT policy attached to', identityId);

          // Force credentials refresh and reconnect
          await fetchAuthSession({ forceRefresh: true });
          reconnect();
        } catch (err: any) {
          if (err?.name !== 'ResourceAlreadyExistsException') {
            console.warn('⚠ IoT policy attach failed:', err);
          }
        }
      })();
    }
  }, []); // run once

  const confirmDeepLinkJoin = async () => {
    if (!pendingCode) return;
    setLinkLoading(true); setLinkErr(null);
    try {
      await generateClient().graphql({
        query: joinEvent,
        variables: { inviteCode: pendingCode },
        authMode:  'userPool',
      });
      setLinkModalVisible(false);
      // you may navigate or refresh events here if you like
      router.push('/events');          // optional UX
    } catch (e:any) {
      setLinkErr(e.errors?.[0]?.message ?? 'Join failed');
    } finally { setLinkLoading(false); }
  };

  // Helper to check if signed in
  const isSignedIn = !!currentUser;

  /* ───────────────────────── UI ───────────────────────── */
  return (
    <ImageBackground
      source={require('@/assets/images/home-background.jpg')}
      style={[styles.background, { backgroundColor: '#1F1F1F' }]}
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

      {/* Button Grid Container */}
      <View style={styles.buttonGrid}>
        {/* Main Event Tile */}
        <TouchableOpacity
          style={styles.mainTile}
          onPress={() => {
            if (!isSignedIn) {
              authModal?.open('signIn');
              return;
            }
            router.push('./events');
          }}
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

            {upcomingEvents.length === 0 ? (
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
            onPress={() => {
              if (!isSignedIn) {
                authModal?.open('signIn');
                return;
              }
              router.push('/menu');
            }}
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
          {currentUser ? (
            isAdmin ? (
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
            )
          ) : (
            // Guest - Sign In Button
            <TouchableOpacity
              style={styles.smallTile}
              onPress={() => authModal?.open('signIn')}
            >
              <View style={styles.iconTextContainer}>
                <View style={styles.iconContainer}>
                  <Ionicons name="log-in" size={28} color="#DFDCD9" />
                </View>
                <View style={styles.textContainer}>
                  <Text style={styles.tileTitle}>Sign In</Text>
                  <Text style={styles.tileSubtext}>Access Account</Text>
                </View>
              </View>
              <View style={styles.glowOverlay} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      {/* ───── Deep-link Join Modal ───── */}
      <Modal
        transparent
        animationType="fade"
        visible={linkModalVisible}
        onRequestClose={() => setLinkModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.joinCard}>
            {/* close button */}
            <TouchableOpacity
              style={styles.filtClose}
              onPress={() => setLinkModalVisible(false)}
            >
              <Ionicons name="close" size={24} color="#DFDCD9"/>
            </TouchableOpacity>

            {/* event summary */}
            <Ionicons name="calendar" size={48} color="#CE975E" style={{marginBottom:10}}/>
            <Text style={[styles.filtTitle,{marginBottom:4}]}>
              {linkEvent?.name ?? 'Event'}
            </Text>
            {linkEvent && (
              <Text style={[styles.detail,{marginBottom:16}]}>
                {new Date(linkEvent.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                {"  "}
                {new Date(linkEvent.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(linkEvent.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            )}

            {/* error */}
            {linkErr && <Text style={styles.err}>{linkErr}</Text>}

            {/* already in event message */}
            {linkEvent && upcomingEvents.some(e => e.id === linkEvent.id) && (
              <Text style={[styles.err, { color: '#63d44a', marginBottom: 8 }]}>You’re already in this event.</Text>
            )}

            {/* join button */}
            <TouchableOpacity
              style={[
                styles.joinGo,
                (!!linkEvent && upcomingEvents.some(e => e.id === linkEvent.id)) && {
                  backgroundColor: '#444',
                  opacity: 0.6,
                }
              ]}
              onPress={confirmDeepLinkJoin}
              disabled={!!linkLoading || !!(linkEvent && upcomingEvents.some(e => e.id === linkEvent.id))}
            >
              {linkLoading
                ? <ActivityIndicator color="#141414"/>
                : <Text style={[
                    styles.joinGoTxt,
                    (!!linkEvent && upcomingEvents.some(e => e.id === linkEvent.id)) && { color: '#bbb' }
                  ]}>
                    Join Event
                  </Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  wifiIconContainer: { position: 'absolute', top: 115, right: 40, zIndex: 10 },
  /* deep-link popup ---------------------------- */
  joinCard: {                         // container card
    width: '80%',
    backgroundColor: '#1F1F1F',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
  },
  filtClose: {                        // “X” button
    position: 'absolute',
    top: 15,
    right: 15,
    padding: 4,
  },
  filtTitle: {                        // event title
    color: '#DFDCD9',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  detail: {                           // date / time line
    color: '#8F8F8F',
    fontSize: 14,
    textAlign: 'center',
  },
  err: {                              // error text
    color: '#D9534F',
    marginBottom: 8,
    textAlign: 'center',
  },
  joinGo: {                           // join button
    backgroundColor: '#CE975E',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 30,
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: 10,
  },
  joinGoTxt: {                        // button label
    color: '#141414',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',  // semi-transparent backdrop
  },
});