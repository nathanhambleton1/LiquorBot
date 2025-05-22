// ---------------------------------------------------------------------------
// HelpPopup – LiquorBot quick‑start & FAQ (dark‑gold theme)
// Accordion cards with staggered bullet animations
// ---------------------------------------------------------------------------
import React, { useState, useRef, useEffect } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
  Animated,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ---------------------------------------------------------------------------
// SECTION CARD COMPONENT
// ---------------------------------------------------------------------------
function SectionCard({
  title,
  icon,
  items,
}: {
  title: string;
  icon:
    | 'rocket-outline'
    | 'search-outline'
    | 'heart-outline'
    | 'person-circle-outline'
    | 'bug-outline'
    | 'create-outline'
    | 'help-circle-outline';
  items: string[];
}) {
  const [open, setOpen] = useState(false);

  // Animated values – one per bullet
  const anims = useRef(items.map(() => new Animated.Value(0))).current;

  // Staggered animation queue
  useEffect(() => {
    if (open) {
      Animated.stagger(
        70,
        anims.map((v) =>
          Animated.timing(v, {
            toValue: 1,
            duration: 250,
            useNativeDriver: true,
          })
        )
      ).start();
    } else {
      anims.forEach((v) => v.setValue(0));
    }
  }, [open]);

  // Header toggle
  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((prev) => !prev);
  };

  return (
    <View style={styles.section}>
      {/* Header card */}
      <TouchableOpacity
        activeOpacity={0.9}
        style={[styles.secHeader, open && styles.secHeaderOpen]}
        onPress={toggle}
      >
        <Ionicons name={icon} size={20} color="#CE975E" style={{ marginRight: 8 }} />
        <Text style={styles.secTitle}>{title}</Text>
        <View style={{ flex: 1 }} />
        <Ionicons
          name={open ? 'chevron-up-outline' : 'chevron-down-outline'}
          size={22}
          color="#CE975E"
        />
      </TouchableOpacity>

      {/* Body bullets */}
      {open && (
        <View style={styles.secBody}>
          {items.map((txt, i) => {
            const a = anims[i];
            return (
              <Animated.View
                key={txt}
                style={{
                  opacity: a,
                  transform: [
                    {
                      translateY: a.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-6, 0],
                      }),
                    },
                  ],
                }}
              >
                <View style={styles.row}>
                  <Ionicons
                    name="ellipse"
                    size={8}
                    color="#CE975E"
                    style={{ marginTop: 6, marginRight: 10 }}
                  />
                  <Text style={styles.rowText}>{txt}</Text>
                </View>
              </Animated.View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// MAIN POPUP
// ---------------------------------------------------------------------------
export default function HelpPopup() {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#141414' }}
      contentContainerStyle={styles.wrapper}
    >
      {/* TITLE */}
      <Text style={styles.title}>LiquorBot Help&nbsp;Center</Text>
      <View style={styles.divider} />

      {/* SECTION LOOP */}
      {sections.map((s) => (
        <SectionCard key={s.title} {...s} />
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
const sections: { title: string; icon: 'rocket-outline' | 'search-outline' | 'heart-outline' | 'person-circle-outline' | 'bug-outline' | 'create-outline' | 'help-circle-outline'; items: string[] }[] = [
  {
    title: 'Getting Started',
    icon: 'rocket-outline',
    items: [
      'Unbox your LiquorBot and connect it to power. Ensure the device is turned on.',
      'Open the LiquorBot app and navigate to “Device Settings” to pair your LiquorBot via Bluetooth or Wi‑Fi.',
      'Assign ingredients to the LiquorBot slots in “Device Settings.” Use the ingredient list to map each slot correctly.',
      'Tap “Explore Drinks” on the home screen to browse the menu or create your own custom drink.',
      'To create a custom drink, tap the “+” button in the “My Drinks” section and follow the steps to add ingredients and design your drink.',
      'Once your LiquorBot is connected and ingredients are loaded, select a drink and tap “Pour Drink” to start pouring.',
      'Check the connection status at the top of the app to ensure your LiquorBot is ready to use.',
    ],
  },
  {
    title: 'Browsing & Finding Drinks',
    icon: 'search-outline',
    items: [
      'Use the search bar to filter drinks by name or ingredient.',
      'Swipe the category chips to jump to specific categories like Vodka, Rum, or Tequila.',
      'Toggle the funnel icon to access advanced filters.',
      'Only show drinks I can make" limits the list to drinks you can prepare with your current ingredients.',
      'Sort alphabetically" organizes drinks by name.',
      'Only show my custom drinks" displays only your personalized recipes.',
      'Custom drinks are seamlessly integrated into the menu and can be edited by tapping the pencil icon on their expanded card.',
      'Pour drinks directly from the app by tapping "Pour Drink" on an expanded card. Ensure your LiquorBot is connected and has the required ingredients loaded.',
      'Every successful pour is logged in your history for future reference.',
    ],
  },
  {
    title: 'Favorites & History',
    icon: 'heart-outline',
    items: [
      'Tap the heart icon on any drink card to like or unlike a drink.',
      'View all your liked drinks in the “Liked Drinks” section of your profile.',
      'Liked drinks include both built-in recipes and your custom creations.',
      'Pour history is automatically saved locally and includes details like drink name, volume, and timestamp.',
      'Access your pour history in the “History” section of your profile.',
      'To reset your pour history, navigate to Profile Settings and select Clear History.',
      'Liked drinks and history are synced with your account, so they persist across devices.',
    ],
  },
  {
    title: 'Creating a Recipe',
    icon: 'create-outline',
    items: [
      'Tap the “+” button in the “My Drinks” section to start creating a new recipe.',
      'Enter a unique name for your drink. Duplicate names are not recommended.',
      'Add ingredients by selecting them from the list. You can filter by category or search by name.',
      'Specify the volume for each ingredient and set its priority to control the pour order.',
      'Use the “Build Image” tool to design a custom drink image by selecting a glass type, drink color, and garnish.',
      'Save your recipe to make it available in the menu and for pouring.',
      'Edit or delete your custom recipes anytime from the “My Drinks” section.',
    ],
  },
  {
    title: 'Profile & Social',
    icon: 'person-circle-outline',
    items: [
      'Edit your profile details, including first name, last name, and bio, from the “Edit Profile” section.',
      'Tap the profile picture to upload a new image. Supported formats include JPG and PNG.',
      'Your username is permanent and cannot be changed after registration.',
      'Your bio can be up to 100 characters and is visible to others in future social features.',
    ],
  },
  {
    title: 'Troubleshooting',
    icon: 'bug-outline',
    items: [
      'Can’t connect? Hold the LiquorBot power button for 5 seconds to reset Bluetooth or Wi‑Fi settings.',
      'Ensure your phone’s Bluetooth or Wi‑Fi is enabled and the LiquorBot is powered on.',
      'If the app cannot find your LiquorBot, try restarting both the device and the app.',
      'Drinks won’t pour? Verify that the tubing is primed and the ingredient slots are correctly mapped in “Device Settings.”',
      'Check the ingredient levels to ensure there is enough liquid in the containers.',
      'App stuck on loading? Force-quit the app and reopen it. Your state is auto-saved in the cloud.',
      'If the issue persists, clear the app cache from your phone’s settings and log back in.',
      'For hardware issues, contact support at support@liquorbot.io or visit our full documentation for advanced troubleshooting steps.',
    ],
  },
  {
    title: 'Frequently Asked Questions',
    icon: 'help-circle-outline',
    items: [
      'Q: Can I use LiquorBot without an internet connection?\nA: Yes, LiquorBot works over Bluetooth for local control. However, some features like syncing custom recipes require internet access.',
      'Q: How do I clean my LiquorBot?\nA: Run warm water through the tubing using the “Clean” option in Device Settings. Refer to the full documentation for detailed cleaning instructions.',
      'Q: Can I share my custom recipes with friends?\nA: Not yet, but this feature is coming soon in a future update!',
      'Q: What happens if I lose my connection during a pour?\nA: No worries the pour will still complete automatically! Just make sure to reconnect.',
      'Q: How do I reset my LiquorBot to factory settings?\nA: Hold the power button for 10 seconds until the LED blinks red. This will reset all settings, including slot mappings.',
      'Q: Is my data synced across devices?\nA: Yes, your liked drinks, custom recipes, and pour history are synced to your account and accessible on any device.',
      'Q: Can I use non-alcoholic ingredients?\nA: Absolutely! LiquorBot supports mixers, juices, and other non-alcoholic ingredients.',
    ],
  },
];

// ---------------------------------------------------------------------------
// STYLES
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  wrapper: { padding: 24, paddingBottom: 60 },
  title: {
    color: '#DFDCD9',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  divider: {
    height: 2,
    width: 80,
    backgroundColor: '#CE975E',
    alignSelf: 'center',
    marginBottom: 22,
    borderRadius: 2,
  },

  /* Accordion */
  section: { marginBottom: 16 },

  secHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  secHeaderOpen: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },

  secTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },

  secBody: {
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },

  row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  rowText: { flex: 1, color: '#DFDCD9', fontSize: 15, lineHeight: 22 },

  footer: {
    color: '#4F4F4F',
    fontSize: 14,
    marginTop: 16,
    lineHeight: 20,
    marginBottom: 60,
    textAlign: 'center',
  },
  link: { color: '#CE975E' },
});
