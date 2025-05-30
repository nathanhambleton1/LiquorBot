// -----------------------------------------------------------------------------
// File: session-loading.tsx            (REPLACEMENT – 27 May 2025)
// Purpose:  First-run splash that…
//   • refreshes the Cognito token & caches group claims
//   • pulls drinks/ingredients JSON from S3
//   • pre-caches every drink image
//   • shows a classy “glass-filling” animation with bubbles + shine
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
import { useRouter } from 'expo-router';
import { LinearGradient }   from 'expo-linear-gradient';
import { Amplify }           from 'aws-amplify';
import { fetchAuthSession }  from '@aws-amplify/auth';
import { getUrl }            from 'aws-amplify/storage';
import AsyncStorage          from '@react-native-async-storage/async-storage';

import config from '../../src/amplifyconfiguration.json';
Amplify.configure(config);

/* ───────  S3 KEYS WE CARE ABOUT  ─────── */
const DRINKS_KEY      = 'drinkMenu/drinks.json';
const INGREDIENTS_KEY = 'drinkMenu/ingredients.json';

/* ────────────────  dims / colours  ──────────────── */
const GLASS_W   = 140;
const GLASS_H   = 260;
const FILL_CLR  = '#CE975E';
const BG_TOP    = '#0e0e0e';
const BG_BTM    = '#000';

export default function SessionLoading(): ReactElement {
  const router              = useRouter();
  const [pct, setPct]       = useState(0);          // 0 → 1
  const [status, setStatus] = useState('Starting…');

  /* glass-fill animation */
  const fillAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: pct,
      duration: 350,
      easing: Easing.linear,
      useNativeDriver: false,            // height animates
    }).start();
  }, [pct]);

  /* helper to bump % smoothly */
  const upd = (f: number) => setPct(prev => Math.min(prev + f, 1));

  /* ────────────  bubble setup ──────────── */
  type Bubble = { x: number; size: number; anim: Animated.Value };
  const bubbles = useMemo<Bubble[]>(() =>
    Array.from({ length: 10 }, () => ({
      x: Math.random() * (GLASS_W - 24) + 12,
      size: 4 + Math.random() * 8,
      anim: new Animated.Value(0),
    })),
  []); // create once

  /* kick off infinite bubble loops */
  useEffect(() => {
    bubbles.forEach((b, i) => {
      const loop = () => {
        b.anim.setValue(0);
        Animated.timing(b.anim, {
          toValue: 1,
          duration: 3500 + Math.random() * 1500,
          delay: i * 300,
          useNativeDriver: false,
          easing: Easing.linear,
        }).start(loop);
      };
      loop();
    });
  }, [bubbles]);

  /* ----------------  MAIN BOOTSTRAP  ---------------- */
  useEffect(() => {
    (async () => {
      try {
        /* 1️⃣ refresh session + groups */
        setStatus('Refreshing session…');
        const session = await fetchAuthSession({ forceRefresh: true });
        const raw     = session.tokens?.idToken?.payload?.['cognito:groups'] ?? [];
        const groups  = Array.isArray(raw)
          ? raw.filter((g): g is string => typeof g === 'string')
          : [];
        await AsyncStorage.setItem('userGroups', JSON.stringify(groups));
        upd(0.10);

        /* 2️⃣ pull latest JSON */
        setStatus('Downloading recipes…');
        const [drinksUrl, ingUrl] = await Promise.all([
          getUrl({ key: DRINKS_KEY }),
          getUrl({ key: INGREDIENTS_KEY }),
        ]);
        const [drinksRes, ingRes] = await Promise.all([
          fetch(drinksUrl.url),
          fetch(ingUrl.url),
        ]);
        const drinksJson = await drinksRes.text();
        const ingJson    = await ingRes.text();
        await AsyncStorage.multiSet([
          ['drinksJson',       drinksJson],
          ['ingredientsJson',  ingJson   ],
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
        setTimeout(() => router.replace('/(tabs)'), 350); // tiny pause for eye-candy
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------  RENDER --------------- */
  const percent = Math.floor(pct * 100);

  return (
    <LinearGradient colors={[BG_TOP, BG_BTM]} style={styles.flex}>
      {/* stylised glass */}
      <View style={styles.glass}>
        {/* liquid */}
        <Animated.View
          style={[
            styles.fill,
            {
              height: fillAnim.interpolate({
                inputRange : [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        >
          {/* bubbles */}
          {bubbles.map((b, idx) => (
            <Animated.View
              key={idx}
              style={{
                position     : 'absolute',
                left         : b.x,
                bottom       : b.anim.interpolate({
                  inputRange : [0, 1],
                  outputRange: [0, GLASS_H - 24],
                }),
                opacity      : b.anim.interpolate({
                  inputRange : [0, 0.1, 0.9, 1],
                  outputRange: [0, 0.85, 0.85, 0],
                }),
                width        : b.size,
                height       : b.size,
                borderRadius : b.size / 2,
                backgroundColor: 'rgba(255,255,255,0.7)',
              }}
            />
          ))}
        </Animated.View>

        {/* % text */}
        <Text style={styles.percentText}>{percent}%</Text>
      </View>

      {/* status */}
      <Text style={styles.statusText}>{status}</Text>
    </LinearGradient>
  );
}

/* ───────────────  Styles  ─────────────── */
const styles = StyleSheet.create({
  flex:         { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: BG_BTM, },
  glass:        { width: GLASS_W, height: GLASS_H, borderWidth: 4, borderColor: '#DFDCD9', borderRadius: 14, overflow: 'hidden', position: 'relative', backgroundColor: '#111', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 8 },
  fill:         { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: FILL_CLR },
  percentText:  { position: 'absolute', top: GLASS_H / 2 - 16, width: '100%', textAlign: 'center', fontSize: 30, fontWeight: 'bold', color: '#DFDCD9' },
  statusText:   { marginTop: 28, fontSize: 15, color: '#757575' },
});
