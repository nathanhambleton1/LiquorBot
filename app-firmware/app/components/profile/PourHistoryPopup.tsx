// ---------------------------------------------------------------------------
// PourHistoryPopup – shows local/cloud pour history
// ---------------------------------------------------------------------------
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

export interface PourEvent {
  time: string;       // ISO string eg. "2025-04-20T19:32:15‑04:00"
  drinkName: string;
  volumeOz: number;
}

interface Props {
  events: PourEvent[];
  onClear: () => void;
}

export default function PourHistoryPopup({ events, onClear }: Props) {
  // group by calendar date
  const grouped: Record<string, PourEvent[]> = {};
  events.forEach((e) => {
    const d = new Date(e.time).toLocaleDateString();
    grouped[d] = grouped[d] ? [...grouped[d], e] : [e];
  });

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 90 }}>
        {Object.entries(grouped).map(([date, rows]) => (
          <View key={date} style={{ marginBottom: 22 }}>
            <Text style={styles.date}>{date}</Text>
            {rows.map((ev, i) => (
              <View key={i} style={styles.row}>
                <Ionicons name="wine-outline" size={20} color="#CE975E" style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{ev.drinkName}</Text>
                  <Text style={styles.sub}>
                    {new Date(ev.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {ev.volumeOz.toFixed(1)} oz
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ))}
        {events.length === 0 && (
          <Text style={styles.empty}>No pours yet – time to mix something!</Text>
        )}
      </ScrollView>

      {/* sticky clear button */}
      {events.length > 0 && (
        <TouchableOpacity
          style={styles.clearBtn}
          onPress={() =>
            Alert.alert('Clear history?', 'This cannot be undone.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Clear', style: 'destructive', onPress: onClear },
            ])
          }
        >
          <Ionicons name="trash-outline" size={18} color="#DFDCD9" style={{ marginRight: 6 }} />
          <Text style={styles.clearTxt}>Clear History</Text>
        </TouchableOpacity>
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
  clearBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              backgroundColor: '#444', borderRadius: 10, paddingVertical: 12,
              position: 'absolute', bottom: 20, left: 20, right: 20 },
  clearTxt: { color: '#DFDCD9', fontSize: 16, fontWeight: '600' },
});
