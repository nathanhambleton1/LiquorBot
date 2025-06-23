// -----------------------------------------------------------------------------
// File: session-loading.tsx      (REWRITE – 22 Jun 2025)
// Boot-splash that
//   • blocks first-time users until online
//   • resumes if Wi-Fi / cellular is toggled while loading
//   • pulls menu JSON, signs any bare S3 keys and pre-caches ALL images
//   • shows animated progress + rotating feature cards
//   • jumps to /(tabs) only after 100 % OK
// -----------------------------------------------------------------------------
import React, { useEffect, useRef, useState, ReactElement } from 'react';
import {
  View, Text, StyleSheet, Image, Platform,
  Easing as RN_Easing, AppState, AppStateStatus,
  Animated as RNAnimated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter }      from 'expo-router';

import { Amplify }          from 'aws-amplify';
import { fetchAuthSession } from '@aws-amplify/auth';
import { getUrl }           from '@aws-amplify/storage';
import { generateClient }   from 'aws-amplify/api';
import NetInfo              from '@react-native-community/netinfo';
import AsyncStorage         from '@react-native-async-storage/async-storage';
import * as FileSystem      from 'expo-file-system';
import { Asset }            from 'expo-asset';

import {
  IoTClient,
  AttachPolicyCommand,
  ListAttachedPoliciesCommand,
} from '@aws-sdk/client-iot';

import config         from '../../src/amplifyconfiguration.json';
import { listEvents } from '../../src/graphql/queries';

/* ───────── constants ───────── */
const REGION      = 'us-east-1';
const IOT_POLICY  = 'Amplify-App-Policy';
const DRINKS_KEY  = 'drinkMenu/drinks.json';
const INGS_KEY    = 'drinkMenu/ingredients.json';
const LOGO        = require('@/assets/images/logo.png');
const APP_NAME    = 'LiquorBot';

/* gradient + palette */
const COL_BG_TOP  = '#4F4F4F';
const COL_BG_BOT  = '#000';
const COL_BAR     = '#CE975E';
const COL_BAR_BG  = '#2B2B2B';

Amplify.configure(config);

/* ---------- helpers ---------- */
const getLocalPath = (id: number, remote: string) => {
  const ext = remote.split('.').pop()?.split('?')[0] || 'jpg';
  return `${FileSystem.cacheDirectory}drink-images/drink_${id}.${ext}`;
};

async function toSigned(remoteOrKey: string): Promise<string> {
  if (/^https?:/i.test(remoteOrKey)) return remoteOrKey;
  try {
    const { url } = await getUrl({
      key: remoteOrKey,
      options: { accessLevel: 'guest', expiresIn: 60 * 60 * 24 }, // 24 h
    });
    return url.toString();
  } catch {
    return remoteOrKey; // fallback (will 404 if truly invalid)
  }
}

async function fetchJsonOrCache(url: string, current: string): Promise<string> {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const txt = await res.text();
    JSON.parse(txt);           // throws if not valid JSON
    return txt;                // ✓ good payload
  } catch (err) {
    console.warn('JSON fetch failed → keeping cache', err);
    return current;            // keep whatever we already had
  }
}

async function clearImageCache() {
  try {
    const dir = `${FileSystem.cacheDirectory}drink-images`;
    const info = await FileSystem.getInfoAsync(dir);
    if (info.exists) {
      await FileSystem.deleteAsync(dir, { idempotent: true });
    }
  } catch (err) {
    console.warn('Failed to clear image cache:', err);
  }
}

async function cacheImages(
  list: { id: number; image: string }[],
  bump: (frac: number) => void,
  start = 0,
  range = 1,
): Promise<void> {
  const total = list.length || 1;
  let done = 0;

  for (const d of list) {
    if (!d.image) { done++; bump(start + (done / total) * range); continue; }

    try {
      const local = getLocalPath(d.id, d.image);
      const info  = await FileSystem.getInfoAsync(local);

      if (!info.exists || info.size === 0) {
        const signed = await toSigned(d.image);
        await FileSystem.makeDirectoryAsync(
          local.substring(0, local.lastIndexOf('/')),
          { intermediates: true },
        );
        await FileSystem.downloadAsync(signed, local);
      }
    } catch (err) {
      // Log error for debugging, but continue
      console.warn(`Failed to cache image for id ${d.id}:`, err);
    }

    done++; bump(start + (done / total) * range);
  }
}

async function attachIoTPolicy(): Promise<void> {
  const { identityId, credentials } = await fetchAuthSession();
  if (!identityId) return;

  const iot = new IoTClient({ region: REGION, credentials });
  const { policies = [] } = await iot.send(
    new ListAttachedPoliciesCommand({ target: identityId }),
  );
  if (policies.some(p => p.policyName === IOT_POLICY)) return;

  await iot.send(new AttachPolicyCommand({ policyName: IOT_POLICY, target: identityId }));
}

/* ───────── component ───────── */
export default function SessionLoading(): ReactElement {
  const router = useRouter();
  const [pct, setPct]       = useState(0);
  const [status, setStatus] = useState('Starting…');
  const [online, setOnline] = useState<boolean>(true);
  const [firstRun, setFirstRun] = useState<boolean>(false); // true ⇢ no cached JSON yet
  const progress = useRef(new RNAnimated.Value(0)).current;
  const cancel   = useRef<boolean>(false);                  // abort flag
  const retryCount = useRef<number>(0);                    // retry counter
  const maxRetries = 5;

  const bump = (f: number) => setPct(p => Math.min(f, 1));

  /* live connectivity watcher */
  useEffect(() => {
    const unsub = NetInfo.addEventListener(({ isConnected }) => {
      setOnline(!!isConnected);
    });
    return unsub;
  }, []);

  /* tie the bar animation to pct */
  useEffect(() => {
    RNAnimated.timing(progress, {
      toValue: pct,
      duration: 350,
      easing: RN_Easing.linear,
      useNativeDriver: false,
    }).start();
  }, [pct]);

  /* restart bootstrap when connectivity returns or app resumes */
  useEffect(() => {
    let retryTimeout: NodeJS.Timeout | null = null;
    const runBootstrap = () => {
      if (!online) return;              // hold until internet
      if (pct > 0 && pct < 0.99) return; // already running
      setPct(0);
      bootstrap().catch(err => {
        console.warn('bootstrap error →', err);
        setStatus('Unexpected error – retrying…');
        if (retryCount.current < maxRetries) {
          const delay = Math.min(2000 * Math.pow(2, retryCount.current), 20000); // exponential backoff, max 20s
          retryCount.current += 1;
          retryTimeout = setTimeout(runBootstrap, delay);
        } else {
          setStatus('Failed to load after several attempts. Please restart the app.');
        }
      });
    };

    const appStateCb = (s: AppStateStatus) => s === 'active' && runBootstrap();
    const unsubApp   = AppState.addEventListener('change', appStateCb);
    runBootstrap();
    return () => {
      unsubApp.remove();
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [online]);

  /* --------------- main bootstrap --------------- */
  async function bootstrap(): Promise<void> {
    cancel.current = false;

    /* only clear if we ever need to invalidate the cache
       (e.g. bundle update or you bump IMG_CACHE_VER) */
    const IMG_CACHE_VER = 1;                      // ↑ bump when assets change
    const ver = await AsyncStorage.getItem('imgCacheVer');
    if (parseInt(ver ?? '0', 10) < IMG_CACHE_VER) {
      await clearImageCache();
      await AsyncStorage.setItem('imgCacheVer', String(IMG_CACHE_VER));
    }

    /* 1 ▸ immediate offline gate on *first-ever* launch */
    const [haveDrinks, haveIngs] = await AsyncStorage.multiGet(['drinksJson', 'ingredientsJson']);
    const coldStart = !(haveDrinks[1] && haveIngs[1]);
    setFirstRun(coldStart);

    if (coldStart && !online) {
      setStatus('Connect to the internet to finish setup'); bump(0.02);
      return; // wait for NetInfo to flip online → bootstrap will re-run
    }

    try {
      /* 2 ▸ refresh Cognito */
      setStatus('Refreshing session…');
      const session = await fetchAuthSession({ forceRefresh: true });
      bump(0.08);

      /* 3 ▸ IoT policy */
      setStatus('Configuring IoT…');
      await attachIoTPolicy(); bump(0.04);

      /* 4 ▸ logo + BG */
      await Asset.loadAsync([LOGO, require('@/assets/images/home-background.jpg')]);
      bump(0.04);

      /* 5 ▸ pull JSON (or use cache when offline) */
      let drinksRaw  = haveDrinks[1] ?? '';
      let ingsRaw    = haveIngs[1]   ?? '';

      if (online) {
        setStatus('Checking for menu updates…');

        const [dUrl, iUrl] = await Promise.all([
          getUrl({ key: DRINKS_KEY }), getUrl({ key: INGS_KEY }),
        ]);

        const [dTxt, iTxt] = await Promise.all([
          fetchJsonOrCache(dUrl.url.toString(), drinksRaw),
          fetchJsonOrCache(iUrl.url.toString(), ingsRaw),
        ]);

        if (dTxt !== drinksRaw) {
          drinksRaw = dTxt;
          await AsyncStorage.setItem('drinksJson', drinksRaw);
        }
        if (iTxt !== ingsRaw) {
          ingsRaw = iTxt;
          await AsyncStorage.setItem('ingredientsJson', ingsRaw);
        }
      } else if (!drinksRaw || !ingsRaw) {
        setStatus('Internet required – retrying…');
        return; // will auto-retry when online
      }

      bump(0.12);

      /* 6 ▸ cache images (signed-URL fallback) */
      setStatus('Caching images…');

      const drinks = JSON.parse(drinksRaw) as { id:number; image:string }[];
      const glassKeys = [
        'drinkMenu/drinkPictures/rocks_white.png',
        'drinkMenu/drinkPictures/highball_white.png',
        'drinkMenu/drinkPictures/martini_white.png',
        'drinkMenu/drinkPictures/coupe_white.png',
        'drinkMenu/drinkPictures/margarita_white.png',
      ];

      const glassDesc = await Promise.all(
        glassKeys.map(async (k, idx) => {
          const { url } = await getUrl({ key: k });
          return { id: 10_000 + idx, image: url.toString() };
        }),
      );

      await cacheImages([...drinks, ...glassDesc], bump, 0.28, 0.70);

      /* 7 ▸ cache upcoming events locally (non-critical) */
      setStatus('Loading events…');
      try {
        const username = session.tokens?.idToken?.payload['cognito:username'] as string;
        if (username) {
          const client  = generateClient();
          const { data } = await client.graphql({
            query: listEvents,
            variables: { filter: { or:[{owner:{eq:username}},{guestOwners:{contains:username}}] } },
            authMode: 'userPool',
          });
          await AsyncStorage.setItem('cachedEvents', JSON.stringify(data?.listEvents?.items ?? []));
        }
      } catch {/* ignore */ }
      bump(0.05);

      /* 8 ▸ done */
      if (!cancel.current) {
        setPct(1);
        setStatus('Ready!');                                         // visual polish
        retryCount.current = 0; // reset retry count on success
        setTimeout(() => router.replace('/(tabs)'), 350);
      }
    } catch (err: any) {
      /* network lost mid-flight → stay put & wait */
      if (!online) { setStatus('Connection lost – waiting…'); return; }
      throw err;
    }
  }

  /* ---------- render ---------- */
  const percent = Math.floor(pct * 100);
  return (
    <LinearGradient colors={[COL_BG_TOP, COL_BG_BOT]} style={styles.flex}>
      <Image source={LOGO} style={styles.logo} resizeMode="contain" />
      <Text style={styles.app}>{APP_NAME}</Text>
      <View style={styles.barWrap}>
        {/* grey background */}
        <View style={StyleSheet.absoluteFill} />
        {/* gold fill grows left → right */}
        <RNAnimated.View
          style={{
            position: 'absolute',          // stick to left edge
            top: 0,
            bottom: 0,                    // ⇒ full bar height
            left: 0,
            width: progress.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }),
           overflow: 'hidden',           // keep rounded ends clean
          }}
        >
          <LinearGradient
            colors={[COL_BAR, '#e0a56f']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </RNAnimated.View>
      </View>
      <Text style={styles.percent}>{percent}%</Text>
      <Text style={styles.status}>
        {online ? status : (firstRun ? 'Internet required for first-time setup' : 'Offline mode')}
      </Text>
    </LinearGradient>
  );
}

/* ---------- styles ---------- */
const styles = StyleSheet.create({
  flex: { flex:1, alignItems:'center', justifyContent:'center' },
  logo: { width:90, height:90, marginBottom:8, ...Platform.select({android:{marginTop:-4}}) },
  app : { fontSize:30, fontWeight:'800', color:COL_BAR, marginBottom:30 },
  barWrap:{ width:280, height:12, backgroundColor:COL_BAR_BG,
            borderRadius:6, overflow:'hidden', marginBottom:12 },
  percent:{ color:'#DFDCD9', fontSize:18, fontWeight:'700' },
  status :{ color:'#757575', fontSize:14, marginTop:4, textAlign:'center',
            paddingHorizontal:24 },
});
