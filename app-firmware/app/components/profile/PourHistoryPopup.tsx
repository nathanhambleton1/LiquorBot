// ---------------------------------------------------------------------------
// PourHistoryPopup – shows cloud pour history (PouredDrink model)
//
// • Fetches the signed-in user’s pours with listPouredDrinks.
// • Groups them by calendar date, newest first.
// • “Clear History” bulk-deletes the user’s PouredDrink items.
//
// Author: Nathan Hambleton
// Updated: Apr 24 2025 – cloud-backed history
// ---------------------------------------------------------------------------
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  KeyboardAvoidingView, // <-- add this
  Platform,             // <-- add this
} from 'react-native';
import { useUnits, ozToMl } from '../UnitsContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { BlurView } from 'expo-blur';

import { generateClient } from 'aws-amplify/api';
import { listPouredDrinks } from '../../../src/graphql/queries';
import { deletePouredDrink } from '../../../src/graphql/mutations';
import { getCurrentUser } from 'aws-amplify/auth';

const client = generateClient();

export interface PourEvent {
  time: string;       // ISO string eg. "2025-04-20T19:32:15Z"
  drinkName: string;
  volumeOz: number;
}

interface Props {
  /** optional callback after cloud log is cleared */
  onClear?: () => void;
}

export default function PourHistoryPopup({ onClear }: Props) {
  const [events, setEvents]   = useState<PourEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { units } = useUnits();
  const [clearing, setClearing] = useState(false); // Add state for clearing spinner

  // Fetch pour history (used for mount and refresh)
  const fetchPourHistory = async () => {
    try {
      const user = await getCurrentUser();
      if (!user?.username) return;

      const res: any = await client.graphql({
        query: listPouredDrinks,
        variables: {
          filter: { userID: { eq: user.username } },
        },
        authMode: 'userPool',
      });

      const items = res.data?.listPouredDrinks?.items ?? [];
      const sortedItems = items.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      const mapped: PourEvent[] = sortedItems.map((it: any) => ({
        time: it.timestamp,
        drinkName: it.drinkName ?? `Drink #${it.drinkID}`,
        volumeOz: Number(it.volume ?? 0),
        id: it.id,                     // keep for deletion
      }));
      setEvents(mapped);
    } catch (e) {
      console.error('fetch history failed', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /* -------------------- load history on mount -------------------- */
  useEffect(() => {
    setLoading(true);
    fetchPourHistory();
  }, []);

  /* -------------------- pull-to-refresh handler ------------------- */
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchPourHistory();
  };

  /* ----------------------- clear history ------------------------ */
  async function clearHistory() {
    try {
      setClearing(true); // Show spinner
      for (const ev of events) {
        await client.graphql({
          query: deletePouredDrink,
          variables: { input: { id: (ev as any).id } },
          authMode: 'userPool',
        });
      }
      setEvents([]);
      onClear?.();                        // optional parent hook
    } catch (e) {
      console.error('clear history error', e);
      Alert.alert('Oops', 'Could not clear history – try again.');
    } finally {
      setClearing(false); // Hide spinner
    }
  }

  /* ---------------------- filter & sort events ------------------ */
  const filteredEvents = events
    .filter((ev) => {
      const q = searchQuery.toLowerCase();
      const d = new Date(ev.time);
      const dateStr = d.toLocaleDateString().toLowerCase();
      const timeStr = d.toLocaleTimeString().toLowerCase();
      const amtStr = ev.volumeOz.toFixed(1);
      return (
        ev.drinkName.toLowerCase().includes(q) ||
        dateStr.includes(q) ||
        timeStr.includes(q) ||
        amtStr.includes(q)
      );
    })
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  /* ---------------------- group by date ------------------------- */
  const grouped: Record<string, PourEvent[]> = {};
  filteredEvents.forEach((e) => {
    const d = new Date(e.time).toLocaleDateString();
    grouped[d] = grouped[d] ? [...grouped[d], e] : [e];
  });

  /* ----------------------------- UI ----------------------------- */
  if ((loading && !refreshing) || clearing) { // Show spinner during initial loading or clearing
    return (
      <View style={[styles.center, { padding: 40 }]}> 
        <ActivityIndicator size="large" color="#CE975E" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* only show when there's data */}
        {events.length > 0 && (
          <View style={styles.searchBarContainer}>
            <Ionicons
              name="search"
              size={20}
              color="#4F4F4F"
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchBar}
              placeholder="Search history"
              placeholderTextColor="#4F4F4F"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        )}

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 140 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={["#CE975E"]}
            />
          }
        >
          {Object.entries(grouped).map(([date, rows]) => (
            <View key={date} style={{ marginBottom: 22 }}>
              <Text style={styles.date}>{date}</Text>
              {rows.map((ev, i) => (
                <View key={i} style={styles.row}>
                  <Ionicons
                    name="wine-outline"
                    size={20}
                    color="#CE975E"
                    style={{ marginRight: 10, marginTop: 10 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{ev.drinkName}</Text>
                    <Text style={styles.sub}>
                      {new Date(ev.time).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      • {units === 'oz'
                        ? `${ev.volumeOz.toFixed(1)} oz`
                        : `${ozToMl(ev.volumeOz).toFixed(1)} ml`}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ))}

          {events.length === 0 && (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons
                name="glass-cocktail-off"
                size={50}
                color="#4F4F4F"
                style={{ marginBottom: 10 }}
              />
              <Text style={styles.emptyTitle}>No pours yet</Text>
              <Text style={styles.emptySubtitle}>
                Once you pour a drink, it will appear here.
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Floating clear button - moved outside KeyboardAvoidingView */}
      {events.length > 0 && (
        <View style={styles.clearButtonWrapper}>
          <TouchableOpacity
            onPress={() =>
              Alert.alert('Clear history?', 'This cannot be undone.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Clear', style: 'destructive', onPress: clearHistory },
              ])
            }
            style={styles.clearButtonContainer}
          >
            <View style={[styles.clearButtonBox, { marginBottom: 0 }]}> 
              <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
              <Ionicons
                name="trash-outline"
                size={18}
                color="#DFDCD9"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.clearTxt}>Clear History</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  date:     { color: '#CE975E', fontSize: 16, fontWeight: '600', marginBottom: 10, marginTop: -10 },
  row:      { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#1F1F1F',
              padding: 12, borderRadius: 10, marginBottom: 8 },
  name:     { color: '#DFDCD9', fontSize: 16, fontWeight: '600' },
  sub:      { color: '#888', fontSize: 13, marginTop: 2 },
  empty:    { color: '#DFDCD9', fontSize: 16, textAlign: 'center', marginTop: 40 },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  emptyTitle: {
    color: '#CE975E', // Gold color for emphasis
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  emptySubtitle: {
    color: '#888', // Subtle gray for secondary text
    fontSize: 14,
    textAlign: 'center',
  },
  clearButtonWrapper: {
    position: 'absolute',
    bottom: 110,
    left: 20,
    right: 20,
    zIndex: 10, // Ensure it floats above other content
    alignItems: 'center',
  },
  clearButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButtonBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(79,79,79,0.35)', // semi-transparent for glassy look
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 0, // Removed extra marginBottom
    position: 'relative', // Position relative for absolute children
    overflow: 'hidden', // Ensures BlurView is clipped to rounded corners
  },
  clearTxt: {
    color: '#DFDCD9',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  center:   { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F1F1F',
    borderRadius: 10,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 15,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  searchBar: {
    flex: 1,
    color: '#DFDCD9',
    fontSize: 16,
    paddingHorizontal: 10,
  },
  searchIcon: {
    marginRight: 10,
  },
});
