// -----------------------------------------------------------------------------
// File: events.tsx  (UPDATED – 17 May 2025)
// Re‑implements the Event Manager UI so that the category picker and search bar
// match the styling/behaviour of the Menu screen.  Adds a filter‑modal with a
// single alphabetical toggle.  All business logic from the original version is
// preserved.
// -----------------------------------------------------------------------------
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
  ScrollView,
  Modal,
  Switch,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { generateClient } from 'aws-amplify/api';
import { listEvents } from '../src/graphql/queries';
import { deleteEvent } from '../src/graphql/mutations';
import { useLiquorBot } from './components/liquorbot-provider';

const client = generateClient();
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ----------------------- TYPES -----------------------
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
  createdAt?: string;
  updatedAt?: string;
}

export default function EventManager() {
  const router = useRouter();
  const { liquorbotId } = useLiquorBot();

  /* ------------------------- STATE ------------------------- */
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'current' | 'past'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [alphabetical, setAlphabetical] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  /* --------------------- FETCH EVENTS ---------------------- */
  useEffect(() => {
    (async () => {
      try {
        const { data } = await client.graphql({
          query: listEvents,
          variables: { filter: { liquorbotId: { eq: Number(liquorbotId) } } },
        });
        setEvents(
          data.listEvents.items.map((item: any) => ({
            id: item.id,
            name: item.name,
            location: item.location ?? undefined,
            startTime: item.startTime,
            endTime: item.endTime,
            liquorbotId: item.liquorbotId ?? Number(liquorbotId),
            inviteCode: item.inviteCode,
            drinkIDs: item.drinkIDs ?? [],
          })),
        );
      } catch (e) {
        Alert.alert('Error', 'Failed to load events');
      } finally {
        setLoading(false);
      }
    })();
  }, [liquorbotId]);

  /* ------------------- FILTER + SEARCH ------------------- */
  const filteredEvents = useMemo(() => {
    const now = new Date();
    let list = events.filter((evt) => {
      const start = new Date(evt.startTime);
      const end = new Date(evt.endTime);
      if (filter === 'past') return end < now;
      if (filter === 'current') return start <= now && end >= now;
      if (filter === 'upcoming') return start > now;
      return true; // 'all'
    });

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((e) => e.name.toLowerCase().includes(q));
    }

    if (alphabetical) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    // default order: upcoming first by startTime ASC, then current, then past
    if (!alphabetical) {
      list.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    }

    return list;
  }, [events, filter, searchQuery, alphabetical]);

  /* ------------------- DELETE HANDLER ------------------- */
  const confirmDelete = (event: Event) => {
    Alert.alert('Delete Event', `Are you sure you want to delete "${event.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteHandler(event.id) },
    ]);
  };

  const deleteHandler = async (id: string) => {
    try {
      await client.graphql({ query: deleteEvent, variables: { input: { id } } });
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch (e) {
      Alert.alert('Error', 'Failed to delete event');
    }
  };

  /* ------------------ RENDER HELPERS ------------------- */
  const formatDateRange = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    const sameDay = s.toDateString() === e.toDateString();

    const formatTime = (date: Date) =>
      date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); // Exclude seconds

    return sameDay
      ? `${s.toLocaleDateString()} ${formatTime(s)} – ${formatTime(e)}`
      : `${s.toLocaleString([], { hour: '2-digit', minute: '2-digit' })} – ${e.toLocaleString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const renderItem = ({ item }: { item: Event }) => (
    <View style={styles.eventCard}>
      <View style={styles.eventHeader}>
        <Text style={styles.eventName}>{item.name}</Text>
        <View style={styles.eventActions}>
          <TouchableOpacity onPress={() => router.push(`/create-event?edit=${item.id}`)}>
            <Ionicons name="create-outline" size={22} color="#CE975E" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => confirmDelete(item)}>
            <Ionicons name="trash-outline" size={22} color="#D9534F" />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.eventDetail}>{item.location || 'No location specified'}</Text>
      <Text style={styles.eventDetail}>{formatDateRange(item.startTime, item.endTime)}</Text>

      <View style={styles.eventFooter}>
        <Text style={styles.inviteCode}>Invite Code: {item.inviteCode}</Text>
        <Text style={styles.drinkCount}>{item.drinkIDs.length} drinks</Text>
      </View>
    </View>
  );

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
            const key = cat.toLowerCase() as 'all' | 'upcoming' | 'current' | 'past';
            return (
              <TouchableOpacity key={cat} onPress={() => setFilter(key)} style={styles.categoryButton}>
                <View style={styles.categoryButtonContent}>
                  <Text
                    style={[styles.categoryButtonText, filter === key && styles.selectedCategoryText]}
                  >
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
          <Ionicons
            name="funnel-outline"
            size={20}
            color={alphabetical ? '#CE975E' : '#4F4F4F'}
          />
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
            <Ionicons name="calendar-outline" size={40} color="#CE975E" style={styles.emptyIcon} />
            <Text style={styles.emptyText}>Tap the “+ New Event” button to start planning!</Text>
          </View>
        }
      />

      {/* ---------- NEW EVENT BUTTON ---------- */}
      <TouchableOpacity style={styles.createButton} onPress={() => router.push('/create-event')}>
        <Ionicons name="add" size={28} color="#141414" />
        <Text style={styles.createText}>New Event</Text>
      </TouchableOpacity>

      {/* ---------- FILTER MODAL ---------- */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.filterModal}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setFilterModalVisible(false)}
            >
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
    </View>
  );
}

// ----------------------------- STYLES -----------------------------
const styles = StyleSheet.create({
  /* --- layout roots --- */
  container: { flex: 1, backgroundColor: '#141414', paddingTop: 70, paddingHorizontal: 0 },
  loadingScreen: { flex: 1, backgroundColor: '#141414', justifyContent: 'center', alignItems: 'center' },
  title: { color: '#DFDCD9', fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  closeBtn: { position: 'absolute', top: 62, left: 25, zIndex: 10, padding: 10 },

  /* --- category picker (copied from Menu) --- */
  horizontalPickerContainer: { alignItems: 'center', paddingVertical: 5, marginBottom: 5 },
  horizontalPicker: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 },
  categoryButton: { marginTop: 10, paddingHorizontal: 15, marginHorizontal: 5 },
  categoryButtonContent: { alignItems: 'center' },
  categoryButtonText: { color: '#4F4F4F' },
  selectedCategoryText: { color: '#CE975E' },
  underline: { height: 2, backgroundColor: '#CE975E', marginTop: 2, width: '100%' },

  /* --- search bar (copied from Menu) --- */
  searchBarContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1F1F1F', borderRadius: 10, paddingHorizontal: 15, marginHorizontal: 20, marginTop: 0, marginBottom: 20 },
  searchIcon: { marginRight: 10 },
  searchBar: { flex: 1, color: '#DFDCD9', fontSize: 16, paddingVertical: 10 },
  filterIcon: { marginLeft: 10 },

  /* --- event list --- */
  listContent: { paddingBottom: 100, paddingHorizontal: 20 },
  eventCard: { backgroundColor: '#1F1F1F', borderRadius: 12, padding: 16, marginBottom: 12 },
  eventHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  eventName: { color: '#DFDCD9', fontSize: 18, fontWeight: '600', flexShrink: 1 },
  eventActions: { flexDirection: 'row', gap: 12, marginLeft: 10 },
  eventDetail: { color: '#8F8F8F', fontSize: 14, marginBottom: 4 },
  eventFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  inviteCode: { color: '#CE975E', fontSize: 12 },
  drinkCount: { color: '#8F8F8F', fontSize: 12 },

  emptyContainer: { alignItems: 'center', marginTop: 150, paddingHorizontal: 40 },
  emptyIcon: { marginTop: 0, marginBottom: 0 }, // Add this line or customize as needed
  emptyText: { color: '#4F4F4F', textAlign: 'center', marginTop: 20, fontSize: 14 },

  /* --- create button --- */
  createButton: { position: 'absolute', bottom: 30, right: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: '#CE975E', borderRadius: 25, paddingVertical: 12, paddingHorizontal: 20, gap: 8, ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 }, android: { elevation: 4 } }) },
  createText: { color: '#141414', fontSize: 16, fontWeight: '600' },

  /* --- modal --- */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  filterModal: { width: SCREEN_WIDTH * 0.8, backgroundColor: '#1F1F1F', borderRadius: 10, padding: 20 },
  filterModalTitle: { color: '#DFDCD9', fontSize: 20, fontWeight: 'bold', marginBottom: 20, alignSelf: 'center' },
  filterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  filterLabel: { color: '#DFDCD9', fontSize: 16, flex: 1, flexWrap: 'wrap' },
  modalCloseButton: { position: 'absolute', top: 15, right: 15 },
});
