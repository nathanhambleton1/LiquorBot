// ---------------------------------------------------------------------------
// HelpPopup – simple static help text
// ---------------------------------------------------------------------------
import React from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';

export default function HelpPopup() {
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
      {helpLines.map((l) => <Text key={l} style={styles.txt}>{l}</Text>)}
    </ScrollView>
  );
}

const helpLines = [
  'Welcome to LiquorBot Help!',
  '• Getting Started: Tap “Create Drink” to make your own recipes.',
  '• Browse Categories: Use the category picker to filter drinks.',
  '• Search: Type in the search bar to find a drink by name.',
  '• Favorites: Tap the heart icon on a drink card to like/unlike.',
  '• Make‑able Filter: Toggle the funnel icon to show only drinks you can make.',
  '• Profile: Edit your bio and see your liked drinks history.',
  '• Sign Out: Tap “Sign Out” to log out of your account.',
  'For more detailed instructions, visit our documentation or contact support.',
];

const styles = StyleSheet.create({ txt: { color: '#DFDCD9', fontSize: 16, marginBottom: 10 } });
