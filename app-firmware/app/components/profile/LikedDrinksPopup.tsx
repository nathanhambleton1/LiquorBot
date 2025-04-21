// ---------------------------------------------------------------------------
// LikedDrinksPopup – shows list of liked drinks
// ---------------------------------------------------------------------------
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Drink } from '../../(tabs)/profile';

interface Props { drinks: Drink[] }

export default function LikedDrinksPopup({ drinks }: Props) {
  if (drinks.length === 0)
    return <Text style={styles.emptyText}>You haven’t liked any drinks yet.</Text>;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 70 }}>
      {drinks.map((d) => (
        <View key={d.id} style={styles.item}>
          <Image source={{ uri: d.image }} style={styles.img} />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={styles.name}>{d.name}</Text>
            <Text style={styles.cat}>{d.category}</Text>
          </View>
          <Ionicons name="heart" size={24} color="#CE975E" style={{ marginRight: 10 }} />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  emptyText: { color: '#DFDCD9', fontSize: 16, textAlign: 'center', marginTop: 30 },
  item:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1F1F1F',
               borderRadius: 10, marginBottom: 10, padding: 10 },
  img:       { width: 60, height: 60, borderRadius: 8 },
  name:      { color: '#DFDCD9', fontSize: 16, fontWeight: '600' },
  cat:       { color: '#CE975E', fontSize: 14 },
});
