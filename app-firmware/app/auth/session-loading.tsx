// -----------------------------------------------------------------------------
// File: session-loading.tsx     (DROP‑IN REPLACEMENT — 11 Jun 2025)
// Splash that:
//
//   • refreshes Cognito session & stores group claims
//   • pulls drinks / ingredients JSON from S3
//   • pre‑caches built‑in, custom‑drink *and* glass‑PNG images
//   • shows animated logo, rotating taglines & feature cards
//   • drops you into /(tabs) when finished
// -----------------------------------------------------------------------------
import React, { useEffect, useRef, useState, ReactElement } from 'react';
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
import Ionicons           from '@expo/vector-icons/Ionicons';
import { useRouter }      from 'expo-router';

import { Amplify }         from 'aws-amplify';
import AsyncStorage        from '@react-native-async-storage/async-storage';
import { fetchAuthSession } from '@aws-amplify/auth';
import { getUrl }          from '@aws-amplify/storage';
import { generateClient }  from 'aws-amplify/api';
import { listEvents }      from '../../src/graphql/queries';

import config             from '../../src/amplifyconfiguration.json';
import { Asset }          from 'expo-asset';
import * as FileSystem    from 'expo-file-system';
import NetInfo            from '@react-native-community/netinfo';

import {
  IoTClient,
  AttachPolicyCommand,
  ListAttachedPoliciesCommand,
} from '@aws-sdk/client-iot';

/* ───────────────  Branding / constants  ─────────────── */
const APP_NAME   = 'LiquorBot';
const REGION     = 'us-east-1';
const POLICY     = 'Amplify-App-Policy';
const HOME_BG_KEY= 'home-background';

const LOGO = require('@/assets/images/logo.png');
const DRINKS_KEY      = 'drinkMenu/drinks.json';
const INGREDIENTS_KEY = 'drinkMenu/ingredients.json';

/* ───────────────  Glass‑PNG keys on S3  ─────────────── */
const GLASS_KEYS: string[][] = [
  [ // rocks
    'drinkMenu/drinkPictures/rocks_white.png',
    'drinkMenu/drinkPictures/rocks_amber.png',
    'drinkMenu/drinkPictures/rocks_red.png',
    'drinkMenu/drinkPictures/rocks_green.png',
    'drinkMenu/drinkPictures/rocks_blue.png',
  ],
  [ // highball
    'drinkMenu/drinkPictures/highball_white.png',
    'drinkMenu/drinkPictures/highball_amber.png',
    'drinkMenu/drinkPictures/highball_red.png',
    'drinkMenu/drinkPictures/highball_green.png',
    'drinkMenu/drinkPictures/highball_blue.png',
  ],
  [ // martini
    'drinkMenu/drinkPictures/martini_white.png',
    'drinkMenu/drinkPictures/martini_amber.png',
    'drinkMenu/drinkPictures/martini_red.png',
    'drinkMenu/drinkPictures/martini_green.png',
    'drinkMenu/drinkPictures/martini_blue.png',
  ],
  [ // coupe
    'drinkMenu/drinkPictures/coupe_white.png',
    'drinkMenu/drinkPictures/coupe_amber.png',
    'drinkMenu/drinkPictures/coupe_red.png',
    'drinkMenu/drinkPictures/coupe_green.png',
    'drinkMenu/drinkPictures/coupe_blue.png',
  ],
  [ // margarita
    'drinkMenu/drinkPictures/margarita_white.png',
    'drinkMenu/drinkPictures/margarita_amber.png',
    'drinkMenu/drinkPictures/margarita_red.png',
    'drinkMenu/drinkPictures/margarita_green.png',
    'drinkMenu/drinkPictures/margarita_blue.png',
  ],
];

/* ───────────────  UI colours / dims  ─────────────── */
const BAR_W    = 280;
const BAR_H    = 12;
const BAR_BG   = '#2B2B2B';
const BAR_FILL = '#CE975E';
const BG_TOP   = '#4F4F4F';
const BG_BTM   = '#000';

/* rotating taglines */
const TAGLINES = [
  'Mixing magic behind the scenes…',
  'Calibrating pumps & pixels…',
  'Stocking the virtual bar…',
  'Priming lines for perfection…',
];

/* fun feature cards */
const FEATURES = [
  { icon:'beer-outline',        head:'50+ curated cocktails', sub:'From Mojitos to Margaritas, always on tap.' },
  { icon:'timer-outline',       head:'Under 15 s pour‑time',  sub:'Faster than you can say “cheers!”.' },
  { icon:'people-outline',      head:'Multi‑user tab system', sub:'Track everyone’s orders at parties & events.' },
  { icon:'sparkles-outline',    head:'Self‑cleaning cycles',  sub:'Keeps lines fresh with a single tap.' },
  { icon:'add-circle-outline',  head:'Build your own recipes',sub:'Custom volumes, colours, garnishes – you name it.' },
  { icon:'bluetooth-outline',   head:'Easy Bluetooth pairing',sub:'Works fully offline when Wi‑Fi drops.' },
  { icon:'cloud-download-outline', head:'Syncs across devices', sub:'Your likes & history follow you everywhere.' },
  { icon:'water-outline',       head:'Mocktail ready',        sub:'Juices, coffee, or iced tea – no spirits required.' },
  { icon:'construct-outline',   head:'Quick‑swap slots',      sub:'Change ingredients in seconds, spill‑free.' },
  { icon:'shield-checkmark-outline', head:'Food‑safe tubing', sub:'Certified for beverage use, easy to sanitize.' },
].sort(() => Math.random() - 0.5);   // shuffle once

Amplify.configure(config);

/* ───────────────  Top‑level helpers  ─────────────── */
function getLocalDrinkImagePath(drinkId: number, imageUrl: string): string {
  const ext = imageUrl.split('.').pop()?.split('?')[0] || 'jpg';
  return `${FileSystem.cacheDirectory || FileSystem.documentDirectory}drink-images/drink_${drinkId}.${ext}`;
}

/** Download & cache images, updating progress (with Last-Modified check) */
async function cacheDrinkImagesToDisk(
  drinks: { image: string; id: number }[],
  updatePct: (n: number) => void,
  start = 0,
  range = 1,
): Promise<void> {
  const total = drinks.length || 1;
  let done = 0;
  for (const d of drinks) {
    if (d.image) {
      try {
        const localUri = getLocalDrinkImagePath(d.id, d.image);
        const info = await FileSystem.getInfoAsync(localUri);
        // Use a unique key for each image's last-modified
        const lmKey = `imgLastMod:${localUri}`;
        let shouldDownload = false;
        let remoteLastMod = '';
        try {
          // HEAD request to get Last-Modified
          const headResp = await fetch(d.image, { method: 'HEAD' });
          remoteLastMod = headResp.headers.get('Last-Modified') || '';
        } catch {}
        const localLastMod = await AsyncStorage.getItem(lmKey);
        // Check if file is missing, zero bytes, or Last-Modified changed
        if (!info.exists || info.size === 0 || (remoteLastMod && localLastMod !== remoteLastMod)) {
          shouldDownload = true;
        }
        if (shouldDownload) {
          await FileSystem.makeDirectoryAsync(
            localUri.substring(0, localUri.lastIndexOf('/')),
            { intermediates: true },
          );
          await FileSystem.downloadAsync(d.image, localUri);
          if (remoteLastMod) {
            await AsyncStorage.setItem(lmKey, remoteLastMod);
          }
        }
      } catch {/* ignore individual failures */}
    }
    done += 1;
    updatePct(start + (done / total) * range);
  }
}

/* Attach IoT policy if missing */
async function attachIoTPolicy(): Promise<void> {
  try {
    const { identityId, credentials } = await fetchAuthSession();
    if (!identityId) return;

    const iot = new IoTClient({ region: REGION, credentials });
    const { policies = [] } = await iot.send(
      new ListAttachedPoliciesCommand({ target: identityId }),
    );
    if (policies.some(p => p.policyName === POLICY)) return;

    await iot.send(new AttachPolicyCommand({ policyName: POLICY, target: identityId }));
  } catch (err: any) {
    if (err?.name !== 'ResourceAlreadyExistsException') {
      console.warn('⚠ IoT policy attach failed:', err);
    }
  }
}

/* Cache upcoming events for offline access */
async function cacheEventsData(session: any): Promise<void> {
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

/* ───────────────  Component  ─────────────── */
export default function SessionLoading(): ReactElement {
  const router              = useRouter();
  const [pct,    setPct]    = useState(0);          // 0 → 1
  const [status, setStatus] = useState('Starting…');

  /* --- progress bar animation --- */
  const progAnim = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    RNAnimated.timing(progAnim, {
      toValue: pct,
      duration: 350,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, [pct]);

  const bump = (f: number) => setPct(p => Math.min(p + f, 1));

  /* --- rotating card & tagline --- */
  const [cardIdx, setCardIdx] = useState(0);
  const [tagIdx,  setTagIdx]  = useState(0);
  const fadeCard = useRef(new RNAnimated.Value(1)).current;
  const fadeTag  = useRef(new RNAnimated.Value(1)).current;

  useEffect(() => {
    const cycle = (
      fade: RNAnimated.Value,
      setter: React.Dispatch<React.SetStateAction<number>>,
      len: number,
    ) => {
      RNAnimated.sequence([
        RNAnimated.timing(fade, { toValue: 0, duration: 220, useNativeDriver: true }),
        RNAnimated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
      setter(i => (i + 1) % len);
    };
    const id1 = setInterval(() => cycle(fadeCard, setCardIdx, FEATURES.length), 3000);
    const id2 = setInterval(() => cycle(fadeTag,  setTagIdx,  TAGLINES.length), 4000);
    return () => { clearInterval(id1); clearInterval(id2); };
  }, []);

  /* ----------------  MAIN BOOTSTRAP  ---------------- */
  useEffect(() => {
    (async () => {
      /*⓪ Check connectivity */
      const { isConnected } = await NetInfo.fetch();

      /* ① If offline → use cached JSON & images */
      if (!isConnected) {
        setStatus('Offline mode');
        try {
          const [drinksJson, ingJson] = await AsyncStorage.multiGet([
            'drinksJson',
            'ingredientsJson',
          ]);
          if (drinksJson[1] && ingJson[1]) {
            setStatus('Loading cached recipes…'); bump(0.45);
            const drinks = JSON.parse(drinksJson[1]);
            await cacheDrinkImagesToDisk(drinks, bump, 0.45, 0.55);
          }
        } finally {
          setPct(1); setTimeout(() => router.replace('/(tabs)'), 350);
        }
        return;
      }

      try {
        /* ② Refresh Cognito */
        setStatus('Refreshing session…');
        const session = await fetchAuthSession({ forceRefresh: true });
        const groups  = (session.tokens?.idToken?.payload?.['cognito:groups'] ?? []) as string[];
        await AsyncStorage.setItem('userGroups', JSON.stringify(groups));
        bump(0.10);

        /* ③ Pre‑cache logo & home BG */
        setStatus('Loading resources…');
        await Asset.loadAsync([
          require('@/assets/images/home-background.jpg'),
          LOGO,
        ]);
        await AsyncStorage.setItem(HOME_BG_KEY, 'loaded');
        bump(0.07);                                    // 17 %

        /* ④ IoT policy */
        setStatus('Configuring services…');
        await attachIoTPolicy();
        bump(0.05);                                    // 22 %

        /* ⑤ Pull / update JSON */
        setStatus('Checking for menu updates…');
        const [drinksUrl, ingUrl] = await Promise.all([
          getUrl({ key: DRINKS_KEY }),
          getUrl({ key: INGREDIENTS_KEY }),
        ]);

        // always pull down both JSON files
        setStatus('Downloading menu JSON…');
        const [remoteDrinksJson, remoteIngJson] = await Promise.all([
          fetch(drinksUrl.url, { cache: 'no-cache' }).then(res => res.text()),
          fetch(ingUrl.url,    { cache: 'no-cache' }).then(res => res.text()),
        ]);

        let drinksJson = await AsyncStorage.getItem('drinksJson')     ?? '';
        let ingJson    = await AsyncStorage.getItem('ingredientsJson') ?? '';

        // only overwrite if it actually changed
        if (remoteDrinksJson !== drinksJson) {
          setStatus('Updating drink menu…');
          await AsyncStorage.multiSet([
            ['drinksJson',           remoteDrinksJson],
            ['drinksJsonLastMod',    new Date().toUTCString()],  // optional
          ]);
          drinksJson = remoteDrinksJson;
        }

        if (remoteIngJson !== ingJson) {
          setStatus('Updating ingredients…');
          await AsyncStorage.multiSet([
            ['ingredientsJson',        remoteIngJson],
            ['ingredientsJsonLastMod', new Date().toUTCString()],  // optional
          ]);
          ingJson = remoteIngJson;
        }

        bump(0.13);  // advance the progress bar

        /* ⑥ Events */
        setStatus('Loading events…');
        await cacheEventsData(session);
        bump(0.10);                                    // 45 %

        /* ⑦  ALL custom-drink images (any owner, any event) */
        setStatus('Loading custom drinks…');
        const toNumericId = (uuid: string) =>
          2_000_000 + parseInt(uuid.slice(-6), 36);

        type CustomItem = { id: string; image: string|null };
        let customItems: CustomItem[] = [];
        try {
          const { data } = await generateClient().graphql({
            query: /* GraphQL */ `
              query AllCustomImages {        # returns every recipe that has an image
                listCustomRecipes(limit: 1000) {
                  items { id image }
                }
              }`,
            authMode: 'apiKey',
          }) as any;
          customItems = (data.listCustomRecipes.items as CustomItem[])
            .filter(it => !!it.image);
        } catch { /* offline or first-launch – ignore */ }

        /* ⑧ Build descriptor list & cache images */
        setStatus('Caching images…');

        const drinks        = JSON.parse(drinksJson) as { id:number; image:string }[];
        const glassKeysFlat = GLASS_KEYS.flat();

        const placeholderKeys = [
          'drinkMenu/drinkPictures/rocks.png',
          'drinkMenu/drinkPictures/highball.png',
          'drinkMenu/drinkPictures/martini.png',
          'drinkMenu/drinkPictures/coupe.png',
          'drinkMenu/drinkPictures/margarita.png',
        ];

        const placeholderDesc = await Promise.all(
          placeholderKeys.map(async (k, idx) => {
            const { url } = await getUrl({ key: k });
            return { id: 60_000 + idx, image: url.toString() };
          }),
        );

        /* signed URLs for glass PNGs */
        const glassDesc = await Promise.all(
          glassKeysFlat.map(async (k, idx) => {
            const { url } = await getUrl({ key: k });
            return { id: 50_000 + idx, image: url.toString() };
          }),
        );

        /* signed URLs for custom‑drink images */
        const customDesc = await Promise.all(
          customItems.map(async it => {
            const { url } = await getUrl({ key: it.image! });
            return { id: toNumericId(it.id), image: url.toString() };
          }),
        );

        await cacheDrinkImagesToDisk(
          [...drinks, ...glassDesc, ...customDesc, ...placeholderDesc],
          bump,
          0.45,
          0.55,
        );
      } catch (err) {
        console.warn('session‑loading:', err);
      } finally {
        setPct(1);
        setTimeout(() => router.replace('/(tabs)'), 350);
      }
    })();
  }, [router]);

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
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[StyleSheet.absoluteFill, { borderRadius: BAR_H / 2 }]}
        />
        <RNAnimated.View
          style={[
            styles.barMask,
            {
              position: 'absolute',
              right: 0,
              width: progAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['100%', '0%'],
              }),
            },
          ]}
        />
      </View>

      {/* % + status */}
      <Text style={styles.percent}>{percent}%</Text>
      <Text style={styles.status}>{status}</Text>

      {/* version */}
      <Text style={styles.appVersion}>v1.0.1</Text>
    </LinearGradient>
  );
}

/* ───────────────  styles  ─────────────── */
const styles = StyleSheet.create({
  flex:  { flex:1, alignItems:'center', justifyContent:'center', paddingHorizontal:24 },
  logo:  { width:90, height:90, marginBottom:6, ...Platform.select({android:{marginTop:-4}}) },
  title: { fontSize:30, fontWeight:'800', color:BAR_FILL, marginBottom:4 },
  tagline:{ fontSize:15, fontWeight:'500', color:'#AAAAAA', marginBottom:34 },

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

  barWrap:{ width:BAR_W, height:BAR_H, backgroundColor:BAR_BG,
            borderRadius:BAR_H/2, overflow:'hidden' },
  barMask:{ backgroundColor:BAR_BG, height:'100%' },

  percent:{ marginTop:12, fontSize:18, color:'#DFDCD9', fontWeight:'700' },
  status: { marginTop:4, fontSize:14, color:'#757575' },
  appVersion:{
    position:'absolute', bottom:18, right:24,
    fontSize:13, color:'#888', opacity:0.7, letterSpacing:0.2,
  },
});
