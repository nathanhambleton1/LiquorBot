// -----------------------------------------------------------------------------
// File: session-loading.tsx        (DROP-IN REPLACEMENT – 1 Jun 2025)
// First-run splash that:
//
//   • refreshes Cognito session & caches group claims
//   • pulls drinks / ingredients JSON from S3
//   • pre-caches every drink image
//   • shows a gradient loading bar with %
//   • cycles feature cards (icon + headline + tiny grey explainer)
//   • drops you into /(tabs) when finished
// -----------------------------------------------------------------------------
import React, {
  useEffect,
  useRef,
  useState,
  ReactElement,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Easing,
  Platform,
  Animated as RNAnimated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons            from '@expo/vector-icons/Ionicons';
import { useRouter }       from 'expo-router';

import { Amplify }          from 'aws-amplify';
import { fetchAuthSession } from '@aws-amplify/auth';
import { getUrl }           from 'aws-amplify/storage';
import AsyncStorage         from '@react-native-async-storage/async-storage';
import config               from '../../src/amplifyconfiguration.json';
import { Asset }            from 'expo-asset';
import { generateClient }   from 'aws-amplify/api';
import { listEvents }       from '../../src/graphql/queries';
import {
  IoTClient,
  AttachPolicyCommand,
  ListAttachedPoliciesCommand,
} from '@aws-sdk/client-iot';
import NetInfo from '@react-native-community/netinfo';

/* ───────────────  Branding  ─────────────── */
const APP_NAME   = 'LiquorBot';
const REGION     = 'us-east-1';
const POLICY     = 'Amplify-App-Policy';
const HOME_BG_KEY= 'home-background';

/* ───────────────  Assets  ─────────────── */
const LOGO = require('@/assets/images/logo.png');
const DRINKS_KEY      = 'drinkMenu/drinks.json';
const INGREDIENTS_KEY = 'drinkMenu/ingredients.json';

/* ───────────────  UI colours / dims  ─────────────── */
const BAR_W    = 280;
const BAR_H    = 12;
const BAR_BG   = '#2B2B2B';
const BAR_FILL = '#CE975E';
const BG_TOP   = '#0e0e0e';
const BG_BTM   = '#000';

/* rotating taglines */
const TAGLINES = [
  'Mixing magic behind the scenes…',
  'Calibrating pumps & pixels…',
  'Stocking the virtual bar…',
  'Priming lines for perfection…',
];

/* fun feature cards (headline + tiny grey sub-text) */
const FEATURES = [
  {
    icon: 'beer-outline',
    head: '50+ curated cocktails',
    sub : 'From Mojitos to Margaritas, always on tap.',
  },
  {
    icon: 'timer-outline',
    head: 'Under 15 s pour-time',
    sub : 'Faster than you can say “cheers!”.',
  },
  {
    icon: 'people-outline',
    head: 'Multi-user tab system',
    sub : 'Track everyone’s orders at parties & events.',
  },
  {
    icon: 'sparkles-outline',
    head: 'Self-cleaning cycles',
    sub : 'Keeps lines fresh with a single tap.',
  },
  {
    icon: 'add-circle-outline',
    head: 'Build your own recipes',
    sub : 'Custom volumes, colours, garnishes – you name it.',
  },
  {
    icon: 'bluetooth-outline',
    head: 'Easy Bluetooth pairing',
    sub : 'Works fully offline when Wi-Fi drops.',
  },
  {
    icon: 'cloud-download-outline',
    head: 'Syncs across devices',
    sub : 'Your likes & history follow you everywhere.',
  },
  {
    icon: 'water-outline',
    head: 'Mocktail ready',
    sub : 'Juices, coffee, or iced tea – no spirits required.',
  },
  {
    icon: 'construct-outline',
    head: 'Quick-swap slots',
    sub : 'Change ingredients in seconds, spill-free.',
  },
  {
    icon: 'shield-checkmark-outline',
    head: 'Food-safe tubing',
    sub : 'Certified for beverage use, easy to sanitize.',
  },
].sort(() => Math.random() - 0.5);   // shuffle once

/* ───────────────  Amplify  ─────────────── */
Amplify.configure(config);

/* ───────────────  Component  ─────────────── */
export default function SessionLoading(): ReactElement {
  const router              = useRouter();
  const [pct, setPct]       = useState(0);          // 0 → 1
  const [status, setStatus] = useState('Starting…');

  /* progress bar animation */
  const progAnim = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    RNAnimated.timing(progAnim, {
      toValue: pct,
      duration: 350,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, [pct]);

  /* helper */
  const bump = (f: number) => setPct(p => Math.min(p + f, 1));

  /* feature & tagline cycles */
  const [cardIdx, setCardIdx] = useState(0);
  const [tagIdx,  setTagIdx]  = useState(0);

  const fadeCard = useRef(new RNAnimated.Value(1)).current;
  const fadeTag  = useRef(new RNAnimated.Value(1)).current;

  const cycle = (
    fade: RNAnimated.Value,
    setter: React.Dispatch<React.SetStateAction<number>>,
    arrLen: number,
  ) => {
    RNAnimated.sequence([
      RNAnimated.timing(fade, { toValue: 0, duration: 220, useNativeDriver: true }),
      RNAnimated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
    setter(i => (i + 1) % arrLen);
  };

  useEffect(() => {
    const id1 = setInterval(() => cycle(fadeCard, setCardIdx, FEATURES.length), 3000);
    const id2 = setInterval(() => cycle(fadeTag,  setTagIdx,  TAGLINES.length), 4000);
    return () => { clearInterval(id1); clearInterval(id2); };
  }, []);

  /* ----------------  MAIN BOOTSTRAP  ---------------- */
  useEffect(() => {
    (async () => {
      // Check connectivity
      const { isConnected } = await NetInfo.fetch();
      // Try loading cached JSON if offline
      if (!isConnected) {
        setStatus('Offline mode');
        try {
          const [drinksJson, ingJson, eventsJson] = await AsyncStorage.multiGet(['drinksJson','ingredientsJson','cachedEvents']);
          if (drinksJson[1] && ingJson[1]) {
            setStatus('Loading cached recipes…');
            bump(0.35);
          }
          if (eventsJson[1]) {
            setStatus('Loading cached events…');
            bump(0.10);
          }
          setStatus('Loading cached images…');
          const drinks = drinksJson[1] ? JSON.parse(drinksJson[1]) : [];
          for (const d of drinks) {
            if (d.image) {
              try { await Image.prefetch(d.image); } catch {}
            }
          }
          bump(0.55);
        } catch {}
        // finish
        setPct(1);
        setTimeout(() => router.replace('/(tabs)'), 350);
        return;
      }
      try {
        /* 1️⃣ refresh session */
        setStatus('Refreshing session…');
        const session = await fetchAuthSession({ forceRefresh: true });
        const raw = session.tokens?.idToken?.payload?.['cognito:groups'] ?? [];
        const groups = Array.isArray(raw) ? raw.filter((g): g is string => typeof g === 'string') : [];
        await AsyncStorage.setItem('userGroups', JSON.stringify(groups));
        bump(0.10);

        /* 2️⃣ Preload home background & logo */
        setStatus('Loading resources…');
        await Asset.loadAsync([
          require('@/assets/images/home-background.jpg'),
          LOGO,
        ]);
        await AsyncStorage.setItem(HOME_BG_KEY, 'loaded');
        bump(0.07);                                        // 17 %

        /* 3️⃣ Attach IoT policy */
        setStatus('Configuring services…');
        await attachIoTPolicy();
        bump(0.05);                                        // 22 %

        /* 4️⃣ pull latest JSON */
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
          ['drinksJson',      drinksJson],
          ['ingredientsJson', ingJson ],
        ]);
        bump(0.13);                                        // 35 %

        /* 5️⃣ Fetch events data */
        setStatus('Loading events…');
        await cacheEventsData(session);
        bump(0.10);                                        // 45 %

        /* 6️⃣ pre-cache images */
        setStatus('Caching images…');
        const drinks = JSON.parse(drinksJson) as { image: string }[];
        const total  = drinks.length || 1;
        let done     = 0;

        for (const d of drinks) {
          if (d.image) {
            try { await Image.prefetch(d.image); } catch {}
          }
          done += 1;
          setPct(0.45 + (done / total) * 0.55);
        }
      } catch (err) {
        console.warn('session-loading:', err);
      } finally {
        setPct(1);
        setTimeout(() => router.replace('/(tabs)'), 350);
      }
    })();
  }, []);

  /* ───────────────  render  ─────────────── */
  const percent = Math.floor(pct * 100);

  return (
    <LinearGradient colors={[BG_TOP, BG_BTM]} style={styles.flex}>
      {/* logo */}
      <Image source={LOGO} style={styles.logo} resizeMode="contain" />

      {/* title & tagline */}
      <Text style={styles.title}>{APP_NAME}</Text>
      <RNAnimated.Text style={[styles.tagline, { opacity: fadeTag }]}>
        {TAGLINES[tagIdx]}
      </RNAnimated.Text>

      {/* feature card */}
      <RNAnimated.View style={[styles.card, { opacity: fadeCard }]}>
        <Ionicons
          name={FEATURES[cardIdx].icon as any}
          size={28}
          color={BAR_FILL}
          style={{ marginRight: 12 }}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.cardHead}>{FEATURES[cardIdx].head}</Text>
          <Text style={styles.cardSub}>{FEATURES[cardIdx].sub}</Text>
        </View>
      </RNAnimated.View>

      {/* progress bar */}
      <View style={styles.barWrap}>
        <LinearGradient
          colors={[BAR_FILL, '#e0a56f']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={[StyleSheet.absoluteFill, { borderRadius: BAR_H / 2 }]}
        />
        <RNAnimated.View
          style={[
            styles.barMask,
            {
              position: 'absolute',
              right: 0,
              width: progAnim.interpolate({
                inputRange : [0, 1],
                outputRange: ['100%', '0%'], // same interpolation, but now anchored to right
              }),
            },
          ]}
        />
      </View>

      {/* percentage + status */}
      <Text style={styles.percent}>{percent}%</Text>
      <Text style={styles.status}>{status}</Text>
    </LinearGradient>
  );
}

/* ───────────────  helpers  ─────────────── */
async function attachIoTPolicy() {
  try {
    const { identityId, credentials } = await fetchAuthSession();
    if (!identityId) return;

    const iot = new IoTClient({ region: REGION, credentials });

    const { policies = [] } = await iot.send(
      new ListAttachedPoliciesCommand({ target: identityId }),
    );
    if (policies.some(p => p.policyName === POLICY)) return;

    await iot.send(
      new AttachPolicyCommand({ policyName: POLICY, target: identityId }),
    );
  } catch (err: any) {
    if (err?.name !== 'ResourceAlreadyExistsException') {
      console.warn('⚠ IoT policy attach failed:', err);
    }
  }
}

async function cacheEventsData(session: any) {
  try {
    const username = session.tokens?.idToken?.payload['cognito:username'];
    if (!username) return;

    const client = generateClient();
    const { data } = await client.graphql({
      query: listEvents,
      variables: {
        filter: {
          or: [
            { owner:       { eq: username } },
            { guestOwners: { contains: username } },
          ],
        },
      },
      authMode: 'userPool',
    });

    const now = new Date();
    const events = data.listEvents.items
      .map((item: any) => ({
        id:   item.id,
        name: item.name,
        startTime: item.startTime,
        endTime:   item.endTime,
      }))
      .filter((ev: any) => new Date(ev.endTime) > now)
      .sort(
        (a: any, b: any) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      );

    await AsyncStorage.setItem('cachedEvents', JSON.stringify(events));
  } catch (err) {
    console.error('Error caching events:', err);
  }
}

/* ───────────────  styles  ─────────────── */
const styles = StyleSheet.create({
  flex:{ flex:1, alignItems:'center', justifyContent:'center', paddingHorizontal:24 },

  logo:   { width: 90, height: 90, marginBottom: 6,
            ...Platform.select({ android:{ marginTop:-4 }}) },

  title:  { fontSize: 30, fontWeight:'800', color: BAR_FILL, marginBottom:4 },
  tagline:{ fontSize: 15, fontWeight:'500', color:'#AAAAAA', marginBottom:34 },

  /* feature card */
  card:{
    flexDirection:'row',
    alignItems:'flex-start',
    backgroundColor:'#1B1B1B',
    paddingVertical:12,
    paddingHorizontal:16,
    borderRadius:12,
    marginBottom:30,
    width: BAR_W + 40,
    elevation:6,
    shadowColor:'#000',
    shadowOffset:{ width:0, height:4 },
    shadowOpacity:0.4,
    shadowRadius:6,
  },
  cardHead:{ color:'#DFDCD9', fontSize:16, fontWeight:'700', marginBottom:2 },
  cardSub: { color:'#8C8C8C', fontSize:13, lineHeight:18 },

  /* bar */
  barWrap:{ width:BAR_W, height:BAR_H, backgroundColor:BAR_BG,
            borderRadius:BAR_H/2, overflow:'hidden' },

  barMask:{ backgroundColor:BAR_BG, height:'100%' },

  percent:{ marginTop:12, fontSize:18, color:'#DFDCD9', fontWeight:'700' },
  status: { marginTop:4,  fontSize:14, color:'#757575' },
});
