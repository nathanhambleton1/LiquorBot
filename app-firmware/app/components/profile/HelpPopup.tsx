// ---------------------------------------------------------------------------
// HelpPopup – LiquorBot quick‑start & FAQ (dark‑gold theme)
// ---------------------------------------------------------------------------
import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

export default function HelpPopup() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#141414' }} contentContainerStyle={styles.wrapper}>
      {/* TITLE */}
      <Text style={styles.title}>LiquorBot Help&nbsp;Center</Text>
      <View style={styles.divider} />

      {/* SECTIONS */}
      {sections.map((sec) => (
        <View key={sec.title} style={styles.section}>
          <View style={styles.secHeader}>
            <Ionicons name={sec.icon} size={20} color="#CE975E" style={{ marginRight: 6 }} />
            <Text style={styles.secTitle}>{sec.title}</Text>
          </View>

          {sec.items.map((t) => (
            <View key={t} style={styles.row}>
              <Ionicons name="ellipse" size={8} color="#CE975E" style={{ marginTop: 6, marginRight: 8 }} />
              <Text style={styles.rowText}>{t}</Text>
            </View>
          ))}
        </View>
      ))}

      {/* FOOTER */}
      <Text style={styles.footer}>
        Need more help? Check our&nbsp;
        <Text style={styles.link}>full documentation</Text>
        &nbsp;or email&nbsp;
        <Text style={styles.link}>support@liquorbot.io</Text>.
      </Text>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// DATA
// ---------------------------------------------------------------------------
const sections: { title: string; icon: "rocket-outline" | "search-outline" | "heart-outline" | "person-circle-outline" | "bug-outline"; items: string[] }[] = [
  {
    title: 'Getting Started',
    icon: 'rocket-outline',
    items: [
      'Tap “Create Drink” to invent and save your own recipes.',
      'Set ingredient slots in Device Settings before pouring.',
      'Enable Bluetooth (or Wi‑Fi) on your phone so the app can find your LiquorBot.',
    ],
  },
  {
    title: 'Browsing & Finding Drinks',
    icon: 'search-outline',
    items: [
      'Use the search bar to filter by name or ingredient.',
      'Swipe the category chips to jump to Tequila, Vodka, Rum, etc.',
      'Toggle the funnel icon to show filters like only drinks you can make with current ingredients.',
    ],
  },
  {
    title: 'Favorites & History',
    icon: 'heart-outline',
    items: [
      'Tap the heart on any drink card to like/unlike.',
      'View all liked drinks in your profile under “Liked Drinks”.',
      'Pour history is saved locally and can be viewed in your profile (Profile Settings: Clear History to reset).',
    ],
  },
  {
    title: 'Profile & Social',
    icon: 'person-circle-outline',
    items: [
      'Edit name, profile pic, and bio from “Edit Profile”.',
      'Your username is permanent – choose wisely!',
      'Coming soon: share custom recipes with friends.',
    ],
  },
  {
    title: 'Troubleshooting',
    icon: 'bug-outline',
    items: [
      'Can’t connect? Hold the LiquorBot power button 5 s to reset Bluetooth.',
      'Drinks won’t pour: verify tubing is primed and slot mapping is correct.',
      'App stuck on loading? Force‑quit and reopen; state auto‑saves in the cloud.',
    ],
  },
];

// ---------------------------------------------------------------------------
// STYLES
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  wrapper:  { padding: 24, paddingBottom: 60 },
  title:    { color: '#DFDCD9', fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  divider:  { height: 2, width: 80, backgroundColor: '#CE975E', alignSelf: 'center', marginBottom: 18, borderRadius: 2 },

  section:  { marginBottom: 26 },
  secHeader:{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  secTitle: { color: '#CE975E', fontSize: 18, fontWeight: '600' },

  row:      { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  rowText:  { flex: 1, color: '#DFDCD9', fontSize: 15, lineHeight: 22 },

  footer:   { color: '#4F4F4F', fontSize: 14, marginTop: 10, lineHeight: 20 },
  link:     { color: '#CE975E' },
});
