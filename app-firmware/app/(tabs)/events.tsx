// -----------------------------------------------------------------------------
// File: events.tsx  (REPLACEMENT – 18 May 2025)
// Shows only the user’s own / joined events and fixes invite-code joining.
// -----------------------------------------------------------------------------
import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, Alert, Platform, TextInput, ScrollView,
  Modal, Switch, Dimensions, LayoutAnimation,
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons                     from '@expo/vector-icons/Ionicons';
import { generateClient }           from 'aws-amplify/api';
import { fetchAuthSession }         from '@aws-amplify/auth';
import * as Clipboard               from 'expo-clipboard'; // Import Clipboard API
import { listEvents, eventsByCode, } from '../../src/graphql/queries';
import { deleteEvent, joinEvent, leaveEvent,} from '../../src/graphql/mutations';
import { useLiquorBot }             from '../components/liquorbot-provider';
import { getUrl } from 'aws-amplify/storage';
import { getCustomRecipe } from '../../src/graphql/queries';
import { useLocalSearchParams } from 'expo-router';

const client = generateClient();
const { width: SCREEN_WIDTH } = Dimensions.get('window');

/* ---------- local helpers ---------- */
const eventFilter = (user: string) => ({
  or: [
    { owner:       { eq: user } },
    { guestOwners: { contains: user } },
  ],
});

/* ---------- types ---------- */
interface Event {
  id:          string;
  name:        string;
  description?:string;
  location?:   string;
  startTime:   string;
  endTime:     string;
  liquorbotId: number;
  inviteCode:  string;
  drinkIDs:    number[];
  customRecipeIDs?: string[];
  owner?:      string;
  guestOwners?: string[];
}

export default function EventManager() {
  /* navigation & device context */
  const router                 = useRouter();
  const { liquorbotId, temporaryOverrideId, restorePreviousId } = useLiquorBot();
  const params = useLocalSearchParams<{ join?: string }>();

  /* UI state */
  const [events, setEvents]                 = useState<Event[]>([]);
  const [loading, setLoading]               = useState(true);
  const [filter, setFilter]                 = useState<'all'|'upcoming'|'current'|'past'>('all');
  const [searchQuery, setSearchQuery]       = useState('');
  const [alphabetical, setAlphabetical]     = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  /* join-modal */
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [inviteCodeInput, setInviteCodeInput]   = useState('');
  const [joinLoading, setJoinLoading]           = useState(false);
  const [joinError, setJoinError]               = useState<string|null>(null);

  // Existing state
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [standardDrinks, setStandardDrinks] = useState<Array<{ id: number; name: string }>>([]);
  const [customRecipes, setCustomRecipes] = useState<Array<{ id: string; name: string }>>([]);
  const [processingEvents, setProcessingEvents] = useState<string[]>([]);

  /* who am I? */
  const [currentUser, setCurrentUser] = useState<string|null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const ses = await fetchAuthSession();
        const u   = ses.tokens?.idToken?.payload['cognito:username'];
        setCurrentUser(typeof u === 'string' ? u : null);
        const groups = ses.tokens?.idToken?.payload['cognito:groups'] as string[] | undefined;
        setIsAdmin(groups?.includes('ADMIN') ?? false);
      } catch { setCurrentUser(null); }
    })();
  }, []);

  /* check for query params */
  useEffect(() => {
    if (params.join === 'true') {
      setJoinModalVisible(true);
      // Clear the query param after opening modal
      router.setParams({ join: undefined });
    }
  }, [params.join]);

  /* fetch events that belong to me */
  useEffect(() => {
    if (!currentUser) return;

    (async () => {
      try {
        const { data } = await client.graphql({
          query: listEvents,
          variables: { filter: eventFilter(currentUser) }, // Removed liquorbotId
          authMode:  'userPool',
        }) as { data: any };

        setEvents(
          data.listEvents.items.map((i: any): Event => ({
            id:          i.id,
            name:        i.name,
            location:    i.location ?? undefined,
            description: i.description ?? undefined,
            startTime:   i.startTime,
            endTime:     i.endTime,
            liquorbotId: i.liquorbotId,
            inviteCode:  i.inviteCode,
            drinkIDs:    i.drinkIDs ?? [],
            customRecipeIDs: i.customRecipeIDs ?? [],
            owner:       i.owner,
            guestOwners: i.guestOwners ?? [],
          })),
        );
      } catch (err) {
        Alert.alert('Error', 'Could not load events');
      } finally {
        setLoading(false);
      }
    })();
  }, [currentUser, liquorbotId]);

  // Fetch standard drinks from S3
  useEffect(() => {
    const fetchStandardDrinks = async () => {
      try {
        const dUrl = await getUrl({ key: 'drinkMenu/drinks.json' });
        const response = await fetch(dUrl.url);
        const data = await response.json();
        setStandardDrinks(data);
      } catch (error) {
        console.error('Error fetching standard drinks:', error);
      }
    };
    fetchStandardDrinks();
  }, []);

  // Fetch custom recipes via GraphQL
  useEffect(() => {
    const fetchCustomRecipesForEvents = async () => {
      const allCustomRecipeIDs = events.flatMap(event => event.customRecipeIDs || []);
      const uniqueIDs = Array.from(new Set(allCustomRecipeIDs));

      const fetchedRecipes = [];
      for (const id of uniqueIDs) {
        try {
          try {
            const { data } = await client.graphql({
              query: getCustomRecipe,
              variables: { id },
              authMode: 'apiKey',
            });
            if(data?.getCustomRecipe) {
              fetchedRecipes.push(data.getCustomRecipe);
            }
          } catch (error) {
            console.error(`Error fetching recipe ${id}:`, error);
            // Add fallback
            fetchedRecipes.push({ 
              id, 
              name: `Custom Drink (${id.slice(0,6)})` 
            });
          }
        } catch (error) {
          console.error(`Error fetching custom recipe ${id}:`, error);
        }
      }
      setCustomRecipes(fetchedRecipes);
    };

    if (events.length > 0) {
      fetchCustomRecipesForEvents();
    }
  }, [events]);

  useEffect(() => {
    if (events.length === 0) return;

    const timers: NodeJS.Timeout[] = [];
    const now = Date.now();

    events.forEach(ev => {
      const start = new Date(ev.startTime).getTime();
      const end   = new Date(ev.endTime).getTime();

      // Already in-progress → switch immediately
      if (start <= now && end > now) {
        temporaryOverrideId(String(ev.liquorbotId), new Date(end));
      }

      // Future start
      if (start > now) {
        timers.push(setTimeout(
          () => temporaryOverrideId(String(ev.liquorbotId), new Date(ev.endTime)),
          start - now,
        ));
      }
    });

    // Cleanup on event list change / unmount
    return () => timers.forEach(clearTimeout);
  }, [events, temporaryOverrideId]);

  /* ---------- filtering / searching ---------- */
  const filteredEvents = useMemo(() => {
    const now = new Date();
    
    // Create groups for each event type
    const currentEvents = events.filter(e => {
      const start = new Date(e.startTime);
      const end = new Date(e.endTime);
      return start <= now && end >= now;
    });

    const upcomingEvents = events.filter(e => {
      const start = new Date(e.startTime);
      return start > now;
    }).sort((a, b) => 
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    const pastEvents = events.filter(e => {
      const end = new Date(e.endTime);
      return end < now;
    }).sort((a, b) => 
      new Date(b.endTime).getTime() - new Date(a.endTime).getTime()
    );

    // Combine groups in the desired order
    let list = [...currentEvents, ...upcomingEvents, ...pastEvents];

    // Apply search filter if needed
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(e => e.name.toLowerCase().includes(q));
    }

    // Apply alphabetical sorting if enabled
    if (alphabetical) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }, [events, searchQuery, alphabetical]);

  /* ---------- delete ---------- */
  const confirmDelete = (ev: Event) =>
    Alert.alert('Delete Event', `Delete “${ev.name}”?`, [
      { text: 'Cancel',  style: 'cancel' },
      { text: 'Delete',  style: 'destructive', onPress: () => doDelete(ev.id) },
    ]);

  const doDelete = async (id: string) => {
    try {
      setProcessingEvents(prev => [...prev, id]);
      await client.graphql({
        query: deleteEvent,
        variables: { input: { id } },
        authMode: 'userPool',
      });
      setEvents((p) => p.filter((e) => e.id !== id));
    } catch {
      Alert.alert('Error', 'Delete failed'); 
    } finally {
      setProcessingEvents(prev => prev.filter(eId => eId !== id));
    }
  };

  const checkForOverlappingEvents = (newEvent: Event, existingEvents: Event[]): Event[] => {
    // Parse times as UTC
    const newStart = new Date(newEvent.startTime);
    const newEnd = new Date(newEvent.endTime);
    const newUTCDate = Date.UTC(
      newStart.getUTCFullYear(), 
      newStart.getUTCMonth(), 
      newStart.getUTCDate()
    );

    return existingEvents.filter(existing => {
      const existingStart = new Date(existing.startTime);
      const existingEnd = new Date(existing.endTime);
      
      // Compare UTC dates (same calendar day)
      const existingUTCDate = Date.UTC(
        existingStart.getUTCFullYear(),
        existingStart.getUTCMonth(),
        existingStart.getUTCDate()
      );
      
      if (newUTCDate !== existingUTCDate) return false;
      
      // Compare precise timestamps (UTC milliseconds)
      return (
        newStart.getTime() < existingEnd.getTime() &&
        newEnd.getTime() > existingStart.getTime()
      );
    });
  };

  /* ---------- join by invite code ---------- */
  const handleJoin = async () => {
    const code = inviteCodeInput.trim().toUpperCase();
    if (!code) { setJoinError('Please enter a code'); return; }

    setJoinLoading(true); 
    setJoinError(null);

    try {
      // First fetch event details
      const { data: eventData } = await client.graphql({
        query: eventsByCode,
        variables: { inviteCode: code },
        authMode: 'userPool',
      }) as { data: { eventsByCode: { items: Event[] } } };

      if (!eventData.eventsByCode.items.length) {
        throw new Error('Event not found. Please check the invite code.');
      }

      const newEvent = eventData.eventsByCode.items[0];

      // Check for overlaps
      const conflicts = checkForOverlappingEvents(newEvent, events);
      if (conflicts.length > 0) {
        const conflictList = conflicts.map(c => 
          `• ${c.name} (${formatRange(c.startTime, c.endTime)})`
        ).join('\n');
        
        setJoinError(
          `Cannot join "${newEvent.name}" (${formatRange(newEvent.startTime, newEvent.endTime)})\n\nConflicts with:\n${conflictList}\n\nResolve conflicts first.`
        );
        return;
      }
      
      // Check if event has already ended
      if (new Date(newEvent.endTime) < new Date()) {
        setJoinError('This event has already ended.');
        return;
      }

      // Proceed with joining
      const { data } = await client.graphql({
        query: joinEvent,
        variables: { inviteCode: code },
        authMode: 'userPool',
      }) as { data: { joinEvent: Event } };

      // Update local state
      setEvents(prev => {
        const exists = prev.some(e => e.inviteCode === code);
        return exists ? prev : [...prev, data.joinEvent];
      });
      
      setJoinModalVisible(false);
      setInviteCodeInput('');
    } catch (err: any) {
      setJoinError(err.errors?.[0]?.message ?? 'Join failed. Check code or try later.');
    } finally {
      setJoinLoading(false);
    }
  };

  /* ---------- render ---------- */
  const formatRange = (s: string, e: string) => {
    const a = new Date(s); 
    const b = new Date(e);
    const sameDay = a.toDateString() === b.toDateString();
    
    const formatDate = (d: Date) => d.toLocaleDateString();
    const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (sameDay) {
      return `${formatDate(a)}  ${formatTime(a)} – ${formatTime(b)}`;
    } else {
      return `${formatDate(a)} ${formatTime(a)} – ${formatDate(b)} ${formatTime(b)}`;
    }
  };

  const [copiedEventId, setCopiedEventId] = useState<string | null>(null);
  const copyToClipboard = (code: string, eventId: string) => {
    Clipboard.setStringAsync(code); // Copy the code to the clipboard
    setCopiedEventId(eventId); // Set the copied event ID
    setTimeout(() => setCopiedEventId(null), 2000); // Clear after 2 seconds
  };

  const handleLeaveEvent = (ev: Event) => {
    Alert.alert('Leave Event', `Leave "${ev.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => doLeaveEvent(ev.id) },
    ]);
  };

  const doLeaveEvent = async (eventId: string) => {
    try {
      setProcessingEvents(prev => [...prev, eventId]);
      await client.graphql({
        query: leaveEvent,
        variables: { eventId },
        authMode: 'userPool'
      });
      setEvents(prev => prev.filter(e => e.id !== eventId));
      restorePreviousId();
    } catch (error) {
      Alert.alert('Error', 'Failed to leave event');
    } finally {
      setProcessingEvents(prev => prev.filter(eId => eId !== eventId));
    }
  };

  const toggleExpand = (eventId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedEventId(expandedEventId === eventId ? null : eventId);
  };

  const renderItem = ({ item }: { item: Event }) => {
    const isOwner = item.owner === currentUser;
    const isGuest = item.guestOwners?.includes?.(currentUser ?? '') ?? false;
    const isPast = new Date(item.endTime) < new Date();
    const isExpanded = expandedEventId === item.id;

    return (
      <TouchableOpacity 
        style={styles.card} 
        onPress={() => toggleExpand(item.id)}
        activeOpacity={0.9}
      >
        <View style={styles.head}>
          <Text style={styles.name}>{item.name}</Text>
          <View style={styles.actions}>
            {isOwner ? (
                <>
                  {!isPast && (
                    <TouchableOpacity onPress={() => router.push(`/create-event?edit=${item.id}`)}>
                      <Ionicons name="create-outline" size={22} color="#CE975E" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => confirmDelete(item)}
                    disabled={processingEvents.includes(item.id)}
                  >
                    {processingEvents.includes(item.id) ? (
                      <ActivityIndicator size="small" color="#D9534F" />
                    ) : (
                      <Ionicons name="trash-outline" size={22} color="#D9534F" />
                    )}
                  </TouchableOpacity>
                </>
              ) : isGuest && (
              <TouchableOpacity 
                onPress={() => handleLeaveEvent(item)} 
                disabled={processingEvents.includes(item.id)}
              >
                {processingEvents.includes(item.id) ? (
                  <ActivityIndicator size="small" color="#D9534F" />
                ) : (
                  <Ionicons name="exit-outline" size={22} color="#D9534F" />
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        <Text style={styles.detail}>{item.location || 'No location'}</Text>
        <Text style={styles.detail}>{formatRange(item.startTime, item.endTime)}</Text>
        {isExpanded && item.description ? (
          <Text style={styles.detail}>{item.description}</Text>
        ) : null}

        {/* Expanded content */}
        {isExpanded && (
          <View style={styles.expandedContent}>
            {/* Drink Menu */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Drink Menu</Text>
              {item.drinkIDs.map((id) => {
                const drink = standardDrinks.find(d => d.id === id);
                return (
                  <Text key={id} style={styles.drinkName}>
                    {drink ? drink.name : `Drink #${id}`}
                  </Text>
                );
              })}
              {item.customRecipeIDs?.map((id) => {
                const recipe = customRecipes.find(r => r.id === id);
                return (
                  <Text key={id} style={styles.drinkName}>
                    {recipe ? recipe.name : `Custom Recipe #${id}`}
                  </Text>
                );
              })}
            </View>

            {/* Invite Link */}
            <View style={styles.section}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.sectionTitle}>Event Link</Text>
                {isExpanded && isAdmin && (
                  <Text style={styles.deviceId}>Device ID: {item.liquorbotId}</Text>
                )}
              </View>
              <View style={styles.inviteRow}>
                <Text style={styles.inviteLink}>https://yourapp.com/join/{item.inviteCode}</Text>
                <TouchableOpacity
                  onPress={() => copyToClipboard(`https://yourapp.com/join/${item.inviteCode}`, item.id)}
                  style={styles.copyButton}
                >
                  <Ionicons name="copy-outline" size={16} color="#CE975E" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Always visible footer */}
        <View style={styles.foot}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.code}>Code: {item.inviteCode}</Text>
            <TouchableOpacity
              onPress={() => copyToClipboard(item.inviteCode, item.id)}
              style={{ marginLeft: 8 }}
            >
              <Ionicons name="copy-outline" size={14} color="#CE975E" />
            </TouchableOpacity>
            {copiedEventId === item.id && (
              <Text style={styles.copiedText}>Code Copied</Text>
            )}
          </View>
          <Text style={styles.drinks}>
            {item.drinkIDs.length + (item.customRecipeIDs?.length ?? 0)} drinks
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#CE975E"/>
      </View>
    );
  }

  /* ---------- UI ---------- */
  return (
    <View style={styles.container}>
      {/* title */}
      <Text style={styles.title}>Event Manager</Text>
      <TouchableOpacity style={styles.close} onPress={() => router.push('/')}>
        <Ionicons name="close" size={28} color="#DFDCD9"/>
      </TouchableOpacity>

      {/* cat picker */}
      <View style={styles.catWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
          {['All','Upcoming','Current','Past'].map((c) => {
            const k = c.toLowerCase() as typeof filter;
            return (
              <TouchableOpacity key={c} onPress={() => setFilter(k)} style={styles.catBtn}>
                <Text style={[styles.catTxt, filter === k && styles.catSel]}>{c}</Text>
                {filter === k && <View style={styles.under}/>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* search bar */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={20} color="#4F4F4F" style={{marginRight:10}}/>
        <TextInput
          style={styles.search}
          placeholder="Search events"
          placeholderTextColor="#4F4F4F"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity onPress={() => setFilterModalVisible(true)}>
          <Ionicons name="funnel-outline" size={20} color={alphabetical? '#CE975E':'#4F4F4F'}/>
        </TouchableOpacity>
      </View>

      {/* list */}
      <FlatList
        data={filteredEvents}
        keyExtractor={(i) => `${i.id}-${i.inviteCode}`}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={40} color="#CE975E"/>
            <Text style={styles.emptyTxt}>Tap “New Event” or “Join Event” to get started</Text>
          </View>
        }
      />

      {/* bottom buttons */}
      <View style={styles.bottom}>
        <TouchableOpacity 
          style={styles.joinBtn} 
          onPress={() => setJoinModalVisible(true)}
          testID="join-event-button"
        >
          <Ionicons name="log-in-outline" size={24} color="#141414"/>
          <Text style={styles.joinTxt}>Join Event</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.newBtn} onPress={() => router.push('/create-event')}>
          <Ionicons name="add" size={28} color="#141414"/>
        </TouchableOpacity>
      </View>

      {/* filter modal */}
      <Modal
        visible={filterModalVisible}
        transparent animationType="fade"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.filtCard}>
            <TouchableOpacity style={styles.filtClose} onPress={() => setFilterModalVisible(false)}>
              <Ionicons name="close" size={24} color="#DFDCD9"/>
            </TouchableOpacity>
            <Text style={styles.filtTitle}>Filter Options</Text>
            <View style={styles.switchRow}>
              <Text style={styles.switchLbl}>Sort alphabetically</Text>
              <Switch
                value={alphabetical}
                onValueChange={setAlphabetical}
                trackColor={{ false:'#4F4F4F', true:'#CE975E' }}
                thumbColor="#DFDCD9"
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* join modal */}
      <Modal
        visible={joinModalVisible}
        transparent animationType="fade"
        onRequestClose={() => setJoinModalVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.joinCard}>
            <TouchableOpacity style={styles.filtClose} onPress={() => setJoinModalVisible(false)}>
              <Ionicons name="close" size={24} color="#DFDCD9"/>
            </TouchableOpacity>
            <Text style={styles.filtTitle}>Enter Invite Code</Text>
            <TextInput
              style={styles.codeInput}
              placeholder="ABC123"
              placeholderTextColor="#4F4F4F"
              autoCapitalize="characters"
              value={inviteCodeInput}
              onChangeText={(t) => setInviteCodeInput(t.toUpperCase())}
            />
            {joinError && <Text style={styles.err}>{joinError}</Text>}
            <TouchableOpacity style={styles.joinGo} onPress={handleJoin} disabled={joinLoading}>
              {joinLoading ? <ActivityIndicator color="#141414"/> : <Text style={styles.joinGoTxt}>Join Event</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ---------- styles ---------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#141414', paddingTop: 70 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#141414' },
  title: { color: '#DFDCD9', fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 30 },
  close: { position: 'absolute', top: 62, left: 24, padding: 10, zIndex: 10 },

  catWrap: { alignItems: 'center', marginBottom: 20 },
  catRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 },
  catBtn: { paddingHorizontal: 15, marginHorizontal: 5 },
  catTxt: { color: '#4F4F4F' },
  catSel: { color: '#CE975E' },
  under: { height: 2, backgroundColor: '#CE975E', marginTop: 2, width: '100%' },

  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1F1F1F', borderRadius: 10, paddingHorizontal: 15, marginHorizontal: 20, marginBottom: 20 },
  search: { flex: 1, color: '#DFDCD9', fontSize: 16, paddingVertical: 10 },

  list: { paddingHorizontal: 20, paddingBottom: 140 },
  card: { backgroundColor: '#1F1F1F', borderRadius: 12, padding: 16, marginBottom: 12 },
  head: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  name: { color: '#DFDCD9', fontSize: 18, fontWeight: '600', flexShrink: 1 },
  actions: { flexDirection: 'row', gap: 12, marginLeft: 10 },
  detail: { color: '#8F8F8F', fontSize: 14, marginBottom: 2 },
  foot: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  code: { color: '#CE975E', fontSize: 12 },
  drinks: { color: '#8F8F8F', fontSize: 12 },

  empty: { alignItems: 'center', marginTop: 150, paddingHorizontal: 40 },
  emptyTxt: { color: '#4F4F4F', textAlign: 'center', marginTop: 20, fontSize: 14 },

  bottom: { position: 'absolute', bottom: 120, left: 0, right: 0, flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20 },
  joinBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#CE975E', borderRadius: 25, paddingVertical: 12, paddingHorizontal: 20, marginRight: 12 },
  joinTxt: { color: '#141414', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  newBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#CE975E', borderRadius: 25, paddingVertical: 12, paddingHorizontal: 12, gap: 8, ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 }, android: { elevation: 4 } }) },
  newTxt: { color: '#141414', fontSize: 16, fontWeight: '600' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  filtCard: { width: SCREEN_WIDTH * 0.8, backgroundColor: '#1F1F1F', borderRadius: 10, padding: 20 },
  filtClose: { position: 'absolute', top: 15, right: 15, padding: 4 },
  filtTitle: { color: '#DFDCD9', fontSize: 20, fontWeight: 'bold', alignSelf: 'center', marginBottom: 20 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchLbl: { color: '#DFDCD9', fontSize: 16 },

  joinCard: { width: SCREEN_WIDTH * 0.8, backgroundColor: '#1F1F1F', borderRadius: 10, padding: 20, alignItems: 'center' },
  codeInput: { width: '100%', borderWidth: 1, borderColor: '#4F4F4F', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 15, color: '#DFDCD9', fontSize: 16, textAlign: 'center', marginBottom: 10 },
  err: { color: '#D9534F', marginBottom: 8 },
  joinGo: { backgroundColor: '#CE975E', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 30, alignSelf: 'stretch', alignItems: 'center' },
  joinGoTxt: { color: '#141414', fontSize: 16, fontWeight: '600' },
  copiedText: { color: '#8F8F8F', fontSize: 8, marginLeft: 8 },

  expandedContent: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#2F2F2F', paddingTop: 12 },
  section: { marginBottom: 16 },
  sectionTitle: { color: '#CE975E', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  drinkName: { color: '#8F8F8F', fontSize: 14, marginBottom: 4 },
  inviteRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#2F2F2F', borderRadius: 8, padding: 12 },
  inviteLink: { color: '#8F8F8F', fontSize: 12, flex: 1, marginRight: 8 },
  copyButton: { padding: 4 },
  deviceId: { color:'#4F4F4F', fontSize:10, marginRight: 4, textAlign: 'right' },
});
