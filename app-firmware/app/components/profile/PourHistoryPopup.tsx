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
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'; // Add this import

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
            // Sorting is not supported in the query; handle it in the application logic
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
    }
  }

  /* ---------------------- group by date ------------------------- */
  const grouped: Record<string, PourEvent[]> = {};
  events.forEach((e) => {
    const d = new Date(e.time).toLocaleDateString();
    grouped[d] = grouped[d] ? [...grouped[d], e] : [e];
  });

  /* ----------------------------- UI ----------------------------- */
  if (loading) {
    return (
      <View style={[styles.center, { padding: 40 }]}>
        <ActivityIndicator size="large" color="#CE975E" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  date:     { color: '#CE975E', fontSize: 16, fontWeight: '600', marginBottom: 6 },
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
});
