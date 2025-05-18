// -----------------------------------------------------------------------------
// File: events.tsx  (REPLACEMENT – 18 May 2025)
// Adds a “Join Event” button & invite-code modal.  Guests are stored in the
// GuestEvent table and cannot edit / delete the host’s event.
// -----------------------------------------------------------------------------
import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, Alert, Platform, TextInput, ScrollView,
  Modal, Switch, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons                    from '@expo/vector-icons/Ionicons';
import { generateClient }          from 'aws-amplify/api';
import { fetchAuthSession }        from '@aws-amplify/auth';
import { listEvents }              from '../src/graphql/queries';
import { deleteEvent }             from '../src/graphql/mutations';
import { createGuestEvent }        from '../src/graphql/mutations';
import { useLiquorBot }            from './components/liquorbot-provider';

const client = generateClient();
const { width: SCREEN_WIDTH } = Dimensions.get('window');

/* ----------------------- TYPES ----------------------- */
interface Event {
  id: string;
  name: string;
  description?: string;
  location?: string;
  startTime: string;
  endTime: string;
  liquorbotId: number;
  inviteCode: string;
  drinkIDs: number[];
  owner?: string;
}

export default function EventManager() {
  const router = useRouter();
  const { liquorbotId } = useLiquorBot();

  /* ------------------------- STATE ------------------------- */
  const [events, setEvents]                   = useState<Event[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [filter, setFilter]                   = useState<'all' | 'upcoming' | 'current' | 'past'>('all');
  const [searchQuery, setSearchQuery]         = useState('');
  const [alphabetical, setAlphabetical]       = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  /* join-modal */
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [inviteCodeInput, setInviteCodeInput]   = useState('');
  const [joinLoading, setJoinLoading]           = useState(false);
  const [joinError, setJoinError]               = useState<string | null>(null);

  /* current user (for owner check) */
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  /* ------------------ WHO AM I ------------------ */
  useEffect(() => {
    (async () => {
      try {
        const session  = await fetchAuthSession();
        const rawUsername = session.tokens?.idToken?.payload['cognito:username'];
        const username = typeof rawUsername === 'string' ? rawUsername : null;
        setCurrentUser(username);
      } catch {
        setCurrentUser(null);
      }
    })();
  }, []);

  /* --------------------- FETCH EVENTS ---------------------- */
  useEffect(() => {
    if (!currentUser) return;      // wait until we know who we are

    (async () => {
      try {
        const result = await client.graphql({
          query: listEvents,
          variables: { filter: { liquorbotId: { eq: Number(liquorbotId) } } },
          authMode: 'userPool',
        });
  
        const data = (result as { data?: any })?.data;
        setEvents(
          data.listEvents.items.map((i: any) => ({
            id:          i.id,
            name:        i.name,
            location:    i.location ?? undefined,
            startTime:   i.startTime,
            endTime:     i.endTime,
            liquorbotId: i.liquorbotId,
            inviteCode:  i.inviteCode,
            drinkIDs:    i.drinkIDs ?? [],
            owner:       i.owner,          // still present → keeps your “edit” lockout
          })),
        );
      } catch (e) {
        Alert.alert('Error', 'Failed to load events');
      } finally {
        setLoading(false);
      }
    })();
  }, [liquorbotId, currentUser]);

  /* ------------------- FILTER + SEARCH ------------------- */
  const filteredEvents = useMemo(() => {
    const now = new Date();
    let list = events.filter((evt) => {
      const start = new Date(evt.startTime);
      const end = new Date(evt.endTime);
      if (filter === 'past')     return end   < now;
      if (filter === 'current')  return start <= now && end >= now;
      if (filter === 'upcoming') return start >  now;
      return true; // 'all'
    });

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((e) => e.name.toLowerCase().includes(q));
    }

    if (alphabetical) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      list.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    }
    return list;
  }, [events, filter, searchQuery, alphabetical]);

  /* ------------------- DELETE HANDLER ------------------- */
  const confirmDelete = (event: Event) => {
    Alert.alert('Delete Event', `Are you sure you want to delete "${event.name}"?`, [
      { text: 'Cancel',  style: 'cancel' },
      { text: 'Delete',  style: 'destructive', onPress: () => deleteHandler(event.id) },
    ]);
  };

  const deleteHandler = async (id: string) => {
    try {
      await client.graphql({ query: deleteEvent, variables: { input: { id } } });
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch {
      Alert.alert('Error', 'Failed to delete event');
    }
  };

  /* ------------------- JOIN HANDLER ------------------- */
  const handleJoinEvent = async () => {
    const code = inviteCodeInput.trim();
    if (!code) { setJoinError('Please enter a code.'); return; }

    setJoinLoading(true);
    setJoinError(null);
    try {
      const result = await client.graphql({
        query: listEvents,                                // <- use the generated op
        variables: { filter: { inviteCode: { eq: code } } },
        authMode: 'userPool',
      }) as { data?: any };

      const match: Event | undefined = result.data?.listEvents?.items?.[0];
      if (!match) {
        setJoinError('Invalid invite code.');
        return;
      }

      /* already joined? */
      if (events.some((e) => e.id === match.id)) {
        setJoinError('You have already joined this event.');
        return;
      }

      /* persist guest membership */
      await client.graphql({
        query: createGuestEvent,
        variables: { input: { eventID: match.id } },
      });

      /* add to local list (non-owner) */
      setEvents((prev) => [...prev, { ...match }]);
      setJoinModalVisible(false);
      setInviteCodeInput('');
    } catch (e) {
      setJoinError('Could not join event.');
    } finally {
      setJoinLoading(false);
    }
  };

  /* ------------------ RENDER HELPERS ------------------- */
  const formatDateRange = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    const sameDay = s.toDateString() === e.toDateString();
    const fmtTime = (d: Date) =>
      d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return sameDay
      ? `${s.toLocaleDateString()} ${fmtTime(s)} – ${fmtTime(e)}`
      : `${s.toLocaleString([], { hour: '2-digit', minute: '2-digit' })} – ${e.toLocaleString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const renderItem = ({ item }: { item: Event }) => {
    const isOwner = item.owner === currentUser;

    return (
      <View style={styles.eventCard}>
        <View style={styles.eventHeader}>
          <Text style={styles.eventName}>{item.name}</Text>
          {isOwner && (
            <View style={styles.eventActions}>
              <TouchableOpacity onPress={() => router.push(`/create-event?edit=${item.id}`)}>
                <Ionicons name="create-outline" size={22} color="#CE975E" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => confirmDelete(item)}>
                <Ionicons name="trash-outline" size={22} color="#D9534F" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <Text style={styles.eventDetail}>{item.location || 'No location specified'}</Text>
        <Text style={styles.eventDetail}>{formatDateRange(item.startTime, item.endTime)}</Text>

        <View style={styles.eventFooter}>
          <Text style={styles.inviteCode}>Invite Code: {item.inviteCode}</Text>
          <Text style={styles.drinkCount}>{item.drinkIDs.length} drinks</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#CE975E" />
      </View>
    );
  }

  /* ------------------------- UI ------------------------- */
  return (
    <View style={styles.container}>
      {/* ---------- TITLE ---------- */}
      <Text style={styles.title}>Event Manager</Text>
      <TouchableOpacity style={styles.closeBtn} onPress={() => router.push('/')}>
        <Ionicons name="close" size={28} color="#DFDCD9" />
      </TouchableOpacity>

      {/* ---------- CATEGORY PICKER ---------- */}
      <View style={styles.horizontalPickerContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalPicker}
        >
          {['All', 'Upcoming', 'Current', 'Past'].map((cat) => {
            const key = cat.toLowerCase() as typeof filter;
            return (
              <TouchableOpacity key={cat} onPress={() => setFilter(key)} style={styles.categoryButton}>
                <View style={styles.categoryButtonContent}>
                  <Text style={[styles.categoryButtonText, filter === key && styles.selectedCategoryText]}>
                    {cat}
                  </Text>
                  {filter === key && <View style={styles.underline} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ---------- SEARCH + FILTER ---------- */}
      <View style={styles.searchBarContainer}>
        <Ionicons name="search" size={20} color="#4F4F4F" style={styles.searchIcon} />
        <TextInput
          style={styles.searchBar}
          placeholder="Search events"
          placeholderTextColor="#4F4F4F"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity onPress={() => setFilterModalVisible(true)} style={styles.filterIcon}>
          <Ionicons name="funnel-outline" size={20} color={alphabetical ? '#CE975E' : '#4F4F4F'} />
        </TouchableOpacity>
      </View>

      {/* ---------- EVENT LIST ---------- */}
      <FlatList
        data={filteredEvents}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={40} color="#CE975E" />
            <Text style={styles.emptyText}>Tap “New Event” or “Join Event” to get started!</Text>
          </View>
        }
      />

      {/* ---------- BOTTOM BUTTONS ---------- */}
      <View style={styles.bottomButtons}>
        {/* join */}
        <TouchableOpacity style={styles.joinButton} onPress={() => setJoinModalVisible(true)}>
          <Ionicons name="log-in-outline" size={24} color="#141414" />
          <Text style={styles.joinText}>Join Event</Text>
        </TouchableOpacity>

        {/* new */}
        <TouchableOpacity style={styles.createButton} onPress={() => router.push('/create-event')}>
          <Ionicons name="add" size={28} color="#141414" />
          <Text style={styles.createText}>New Event</Text>
        </TouchableOpacity>
      </View>

      {/* ---------- FILTER MODAL ---------- */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.filterModal}>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setFilterModalVisible(false)}>
              <Ionicons name="close" size={24} color="#DFDCD9" />
            </TouchableOpacity>
            <Text style={styles.filterModalTitle}>Filter Options</Text>

            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>Sort alphabetically</Text>
              <Switch
                value={alphabetical}
                onValueChange={setAlphabetical}
                trackColor={{ false: '#4F4F4F', true: '#CE975E' }}
                thumbColor="#DFDCD9"
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ---------- JOIN MODAL ---------- */}
      <Modal
        visible={joinModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setJoinModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.joinModal}>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setJoinModalVisible(false)}>
              <Ionicons name="close" size={24} color="#DFDCD9" />
            </TouchableOpacity>
            <Text style={styles.filterModalTitle}>Enter Invite Code</Text>

            <TextInput
              style={styles.codeInput}
              placeholder="e.g. ABC123"
              placeholderTextColor="#4F4F4F"
              autoCapitalize="characters"
              value={inviteCodeInput}
              onChangeText={(text) => setInviteCodeInput(text.toUpperCase())} // Auto-capitalize input
            />
            {joinError && <Text style={styles.errorText}>{joinError}</Text>}

            <TouchableOpacity style={styles.joinConfirmBtn} onPress={handleJoinEvent} disabled={joinLoading}>
              {joinLoading ? (
                <ActivityIndicator color="#141414" />
              ) : (
                <Text style={styles.joinConfirmText}>Join Event</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ----------------------------- STYLES ----------------------------- */
const styles = StyleSheet.create({
  /* --- layout roots --- */
  container:           { flex: 1, backgroundColor: '#141414', paddingTop: 70 },
  loadingScreen:       { flex: 1, backgroundColor: '#141414', justifyContent: 'center', alignItems: 'center' },
  title:               { color: '#DFDCD9', fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  closeBtn:            { position: 'absolute', top: 62, left: 25, zIndex: 10, padding: 10 },

  /* --- category picker --- */
  horizontalPickerContainer: { alignItems: 'center', paddingVertical: 5, marginBottom: 5 },
  horizontalPicker:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 },
  categoryButton:      { marginTop: 10, paddingHorizontal: 15, marginHorizontal: 5 },
  categoryButtonContent:{ alignItems: 'center' },
  categoryButtonText:  { color: '#4F4F4F' },
  selectedCategoryText:{ color: '#CE975E' },
  underline:           { height: 2, backgroundColor: '#CE975E', marginTop: 2, width: '100%' },

  /* --- search bar --- */
  searchBarContainer:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1F1F1F', borderRadius: 10, paddingHorizontal: 15, marginHorizontal: 20, marginBottom: 20 },
  searchIcon:          { marginRight: 10 },
  searchBar:           { flex: 1, color: '#DFDCD9', fontSize: 16, paddingVertical: 10 },
  filterIcon:          { marginLeft: 10 },

  /* --- event list --- */
  listContent:         { paddingBottom: 140, paddingHorizontal: 20 },
  eventCard:           { backgroundColor: '#1F1F1F', borderRadius: 12, padding: 16, marginBottom: 12 },
  eventHeader:         { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  eventName:           { color: '#DFDCD9', fontSize: 18, fontWeight: '600', flexShrink: 1 },
  eventActions:        { flexDirection: 'row', gap: 12, marginLeft: 10 },
  eventDetail:         { color: '#8F8F8F', fontSize: 14, marginBottom: 4 },
  eventFooter:         { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  inviteCode:          { color: '#CE975E', fontSize: 12 },
  drinkCount:          { color: '#8F8F8F', fontSize: 12 },

  emptyContainer:      { alignItems: 'center', marginTop: 150, paddingHorizontal: 40 },
  emptyText:           { color: '#4F4F4F', textAlign: 'center', marginTop: 20, fontSize: 14 },

  /* --- bottom buttons --- */
  bottomButtons:       { position: 'absolute', bottom: 30, flexDirection: 'row', width: '100%', paddingHorizontal: 20, justifyContent: 'space-between' },
  joinButton:          { flexDirection: 'row', alignItems: 'center', backgroundColor: '#CE975E', borderRadius: 25, paddingVertical: 12, paddingHorizontal: 20, gap: 8 },
  joinText:            { color: '#141414', fontSize: 16, fontWeight: '600' },
  createButton:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#CE975E', borderRadius: 25, paddingVertical: 12, paddingHorizontal: 20, gap: 8, ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 }, android: { elevation: 4 } }) },
  createText:          { color: '#141414', fontSize: 16, fontWeight: '600' },

  /* --- filter modal --- */
  modalOverlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  filterModal:         { width: SCREEN_WIDTH * 0.8, backgroundColor: '#1F1F1F', borderRadius: 10, padding: 20 },
  filterModalTitle:    { color: '#DFDCD9', fontSize: 20, fontWeight: 'bold', marginBottom: 20, alignSelf: 'center' },
  filterRow:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  filterLabel:         { color: '#DFDCD9', fontSize: 16, flex: 1, flexWrap: 'wrap' },
  modalCloseButton:    { position: 'absolute', top: 15, right: 15 },

  /* --- join modal --- */
  joinModal:           { width: SCREEN_WIDTH * 0.8, backgroundColor: '#1F1F1F', borderRadius: 10, padding: 20, alignItems: 'center' },
  codeInput:           { width: '100%', borderWidth: 1, borderColor: '#4F4F4F', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 15, color: '#DFDCD9', fontSize: 16, marginBottom: 12, textAlign: 'center' },
  errorText:           { color: '#D9534F', marginBottom: 8 },
  joinConfirmBtn:      { backgroundColor: '#CE975E', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 25, alignSelf: 'stretch', alignItems: 'center' },
  joinConfirmText:     { color: '#141414', fontSize: 16, fontWeight: '600' },
});
