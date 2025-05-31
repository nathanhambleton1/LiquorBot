// -----------------------------------------------------------------------------
// File: session-loading.tsx            (REPLACEMENT – 31 May 2025)
// Purpose:  First-run splash that…
//   • refreshes the Cognito token & caches group claims
//   • pulls drinks/ingredients JSON from S3
//   • pre-caches every drink image
//   • shows a horizontal loading bar with %
//   • rotates feature cards (icon + fact) above the bar
//   • drops you into /(tabs) when finished
// -----------------------------------------------------------------------------
import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  ReactElement,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Image as RNImage,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons           from '@expo/vector-icons/Ionicons';
import { useRouter }      from 'expo-router';

import { Amplify }           from 'aws-amplify';
import { fetchAuthSession }  from '@aws-amplify/auth';
import { getUrl }            from 'aws-amplify/storage';
import AsyncStorage          from '@react-native-async-storage/async-storage';
import config                from '../../src/amplifyconfiguration.json';
Amplify.configure(config);

/* ───────  S3 KEYS  ─────── */
const DRINKS_KEY      = 'drinkMenu/drinks.json';
const INGREDIENTS_KEY = 'drinkMenu/ingredients.json';

/* ─────────────── dims / colours ─────────────── */
const BAR_W     = 280;
const BAR_H     = 12;
const BAR_BG    = '#2B2B2B';
const BAR_FILL  = '#CE975E';
const BG_TOP    = '#0e0e0e';
const BG_BTM    = '#000';

/* fun feature cards shown while we load */
const FEATURES = [
  { icon: 'beer-outline',    text: '50+ curated cocktails' },
  { icon: 'timer-outline',   text: 'Under 15 s pour-time' },
  { icon: 'people-outline',  text: 'Multi-user tab system' },
  { icon: 'sparkles-outline',text: 'Self-cleaning cycles' },
  { icon: 'add-circle-outline', text: 'Build your own recipes' },
];

export default function SessionLoading(): ReactElement {
  const router              = useRouter();
  const [pct, setPct]       = useState(0);          // 0 → 1
  const [status, setStatus] = useState('Starting…');

  /* ────────── animated progress bar ────────── */
  const progAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progAnim, {
      toValue: pct,
      duration: 350,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, [pct, progAnim]);

  /* helper to bump % */
  const upd = (f: number) => setPct(prev => Math.min(prev + f, 1));

  /* ────────── rotating feature cards ────────── */
  const [cardIdx, setCardIdx]      = useState(0);
  const fadeAnim                   = useRef(new Animated.Value(1)).current;
  const cycleCard = () => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
    setCardIdx(i => (i + 1) % FEATURES.length);
  };
  useEffect(() => {
    const id = setInterval(cycleCard, 3000);
    return () => clearInterval(id);
  }, []);

  /* ----------------  MAIN BOOTSTRAP  ---------------- */
  useEffect(() => {
    (async () => {
      try {
        /* 1️⃣ refresh session + groups */
        setStatus('Refreshing session…');
        const session = await fetchAuthSession({ forceRefresh: true });
        const raw     = session.tokens?.idToken?.payload?.['cognito:groups'] ?? [];
        const groups  = Array.isArray(raw) ? raw.filter((g): g is string => typeof g === 'string') : [];
        await AsyncStorage.setItem('userGroups', JSON.stringify(groups));
        upd(0.10);

        /* 2️⃣ pull latest JSON */
        setStatus('Downloading recipes…');
        const [drinksUrl, ingUrl] = await Promise.all([
          getUrl({ key: DRINKS_KEY }),
          getUrl({ key: INGREDIENTS_KEY }),
        ]);
        const [drinksRes, ingRes] = await Promise.all([ fetch(drinksUrl.url), fetch(ingUrl.url) ]);
        const drinksJson = await drinksRes.text();
        const ingJson    = await ingRes.text();
        await AsyncStorage.multiSet([
          ['drinksJson',      drinksJson],
          ['ingredientsJson', ingJson   ],
        ]);
        upd(0.25);                           // cumulative = 0.35

        /* 3️⃣ pre-cache images */
        setStatus('Caching images…');
        const drinks = JSON.parse(drinksJson) as { image: string }[];
        const total  = drinks.length || 1;
        let done     = 0;
        for (const d of drinks) {
          if (d.image) {
            try { await RNImage.prefetch(d.image); } catch { /* ignore */ }
          }
          done += 1;
          setPct(0.35 + (done / total) * 0.65);   // → 1.0
        }
      } catch (err) {
        console.warn('session-loading:', err);
      } finally {
        setPct(1);
        setTimeout(() => router.replace('/(tabs)'), 350);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------  RENDER --------------- */
  const percent = Math.floor(pct * 100);

  return (
    <LinearGradient colors={[BG_TOP, BG_BTM]} style={styles.flex}>
      {/* feature card */}
      <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
        <Ionicons
          name={FEATURES[cardIdx].icon as any}
          size={28}
          color={BAR_FILL}
          style={{ marginRight: 10 }}
        />
        <Text style={styles.cardText}>{FEATURES[cardIdx].text}</Text>
      </Animated.View>

      {/* progress bar */}
      <View style={styles.barWrap}>
        <Animated.View
          style={[
            styles.barFill,
            {
              width: progAnim.interpolate({
                inputRange : [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>

      {/* percentage + status */}
      <Text style={styles.percentText}>{percent}%</Text>
      <Text style={styles.statusText}>{status}</Text>
    </LinearGradient>
  );
}

/* ───────────────  Styles  ─────────────── */
const styles = StyleSheet.create({
  flex:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  /* feature card */
  card:      {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1B1B1B',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 28,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  cardText:  { color: '#DFDCD9', fontSize: 16, fontWeight: '600' },
  /* progress bar */
  barWrap:   { width: BAR_W, height: BAR_H, backgroundColor: BAR_BG, borderRadius: BAR_H / 2, overflow: 'hidden' },
  barFill:   { height: '100%', backgroundColor: BAR_FILL },
  percentText:{ marginTop: 12, fontSize: 18, color: '#DFDCD9', fontWeight: '700' },
  statusText:{ marginTop: 4,  fontSize: 14, color: '#757575' },
});
