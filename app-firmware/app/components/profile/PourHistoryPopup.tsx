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
  Modal,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Picker } from '@react-native-picker/picker';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [sortOption, setSortOption] = useState<'date' | 'alphabetical'>('date');
  const [dateRange, setDateRange] = useState<'7days' | 'month' | 'year' | 'all'>('7days');
  const [clearing, setClearing] = useState(false); // Add state for clearing spinner

  /* -------------------- load history on mount -------------------- */
  useEffect(() => {
    (async () => {
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
      }
    })();
  }, []);

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
    .filter((ev) => {
      const now = new Date();
      const eventDate = new Date(ev.time);
      if (dateRange === '7days') {
        return eventDate >= new Date(now.setDate(now.getDate() - 7));
      } else if (dateRange === 'month') {
        return eventDate >= new Date(now.setMonth(now.getMonth() - 1));
      } else if (dateRange === 'year') {
        return eventDate >= new Date(now.setFullYear(now.getFullYear() - 1));
      }
      return true; // 'all' shows all events
    })
    .sort((a, b) => {
      if (sortOption === 'alphabetical')
        return a.drinkName.localeCompare(b.drinkName);
      return new Date(b.time).getTime() - new Date(a.time).getTime();
    });

  /* ---------------------- group by date ------------------------- */
  const grouped: Record<string, PourEvent[]> = {};
  filteredEvents.forEach((e) => {
    const d = new Date(e.time).toLocaleDateString();
    grouped[d] = grouped[d] ? [...grouped[d], e] : [e];
  });

  /* ----------------------------- UI ----------------------------- */
  if (loading || clearing) { // Show spinner during loading or clearing
    return (
      <View style={[styles.center, { padding: 40 }]}>
        <ActivityIndicator size="large" color="#CE975E" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
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
          <TouchableOpacity
            onPress={() => setFilterModalVisible(true)}
            style={styles.filterIcon}
          >
            <Ionicons
              name="funnel-outline"
              size={20}
              color="#4f4f4f"
            />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 90 }}>
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
                    • {ev.volumeOz.toFixed(1)} oz
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

      {/* Floating clear button */}
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
            <View style={styles.clearButtonBox}>
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

      {/* filter modal */}
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

            <Text style={styles.filterLabel}>Date Range:</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={dateRange}
                onValueChange={(value) => setDateRange(value)}
                style={styles.picker}
                dropdownIconColor="#CE975E"
              >
                <Picker.Item label="Past 7 Days" value="7days" />
                <Picker.Item label="Past Month" value="month" />
                <Picker.Item label="Past Year" value="year" />
                <Picker.Item label="All Time" value="all" />
              </Picker>
            </View>

            <Text style={styles.filterLabel}>Sort by:</Text>
            <View style={styles.sortOptionsContainer}>
              <TouchableOpacity
                style={[
                  styles.sortOptionBox,
                  sortOption === 'date' && styles.selectedSortOptionBox,
                ]}
                onPress={() => setSortOption('date')}
              >
                <Text
                  style={[
                    styles.sortOptionText,
                    sortOption === 'date' && styles.selectedSortOptionText,
                  ]}
                >
                  Date
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.sortOptionBox,
                  sortOption === 'alphabetical' && styles.selectedSortOptionBox,
                ]}
                onPress={() => setSortOption('alphabetical')}
              >
                <Text
                  style={[
                    styles.sortOptionText,
                    sortOption === 'alphabetical' && styles.selectedSortOptionText,
                  ]}
                >
                  Alphabetical
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <TouchableOpacity
                onPress={() => {
                  setDateRange('7days');
                  setSortOption('date');
                }}
                style={{ marginRight: 20 }}
              >
                <Text style={styles.filterLabel}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <Text style={{ color: '#CE975E', fontSize: 16 }}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    bottom: 20,
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
    backgroundColor: '#4f4f4f', // Gray box background
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
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
  filterIcon: {
    marginLeft: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterModal: {
    backgroundColor: '#1F1F1F',
    borderRadius: 10,
    padding: 20,
    width: '80%',
  },
  modalCloseButton: {
    alignSelf: 'flex-end',
  },
  filterModalTitle: {
    color: '#CE975E',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  filterLabel: {
    color: '#DFDCD9',
    fontSize: 16,
    marginBottom: 10,
  },
  sortOptionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  sortOptionBox: {
    flex: 1,
    backgroundColor: '#4F4F4F',
    paddingVertical: 10,
    marginHorizontal: 5,
    borderRadius: 10,
    alignItems: 'center',
  },
  selectedSortOptionBox: {
    backgroundColor: '#CE975E',
  },
  sortOptionText: {
    color: '#DFDCD9',
    fontSize: 16,
  },
  selectedSortOptionText: {
    color: '#1F1F1F',
    fontWeight: 'bold',
  },
  pickerContainer: {
    backgroundColor: '#1F1F1F',
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#4F4F4F',
  },
  picker: {
    color: '#DFDCD9',
    fontSize: 16,
    paddingHorizontal: 10,
  },
});
