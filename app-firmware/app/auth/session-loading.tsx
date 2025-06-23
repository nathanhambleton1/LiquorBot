// -----------------------------------------------------------------------------
// File: session-loading.tsx      (REWRITE – 22 Jun 2025)
// Boot-splash that
//   • blocks first-time users until online
//   • resumes if Wi-Fi / cellular is toggled while loading
//   • pulls menu JSON, signs any bare S3 keys and pre-caches ALL images
//   • shows animated progress + rotating feature cards
//   • jumps to /(tabs) only after 100 % OK
// -----------------------------------------------------------------------------
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Image, Platform,
  Easing as RN_Easing, AppState, AppStateStatus,
  Animated as RNAnimated,
  Dimensions,
  Pressable,
} from 'react-native';
import { useRouter }      from 'expo-router';

import { Amplify }          from 'aws-amplify';
import { fetchAuthSession } from '@aws-amplify/auth';
import { getUrl }           from '@aws-amplify/storage';
import { generateClient }   from 'aws-amplify/api';
import NetInfo              from '@react-native-community/netinfo';
import AsyncStorage         from '@react-native-async-storage/async-storage';
import * as FileSystem      from 'expo-file-system';
import { Asset }            from 'expo-asset';
import { PubSub } from '@aws-amplify/pubsub';

import {
  IoTClient,
  AttachPolicyCommand,
  ListAttachedPoliciesCommand,
} from '@aws-sdk/client-iot';
import { useLiquorBot } from '../components/liquorbot-provider';

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
export default function SessionLoading({ modalMode, onFinish, onRequestCloseWithAnimation }: { modalMode?: boolean; onFinish?: () => void; onRequestCloseWithAnimation?: () => void } = {}) {
  const router = useRouter();
  const [pct, setPct]       = useState(0);
  const [status, setStatus] = useState('Starting…');
  const [online, setOnline] = useState<boolean>(true);
  const [firstRun, setFirstRun] = useState<boolean>(false); // true ⇢ no cached JSON yet
  const progress = useRef(new RNAnimated.Value(0)).current;
  const cancel   = useRef<boolean>(false);                  // abort flag
  const retryCount = useRef<number>(0);                    // retry counter
  const maxRetries = 5;

  const { liquorbotId, checkHeartbeatOnce, setLiquorbotId, isConnected, forceDisconnect } = useLiquorBot();

  const bump = (f: number) => setPct(p => Math.min(f, 1));

  // PubSub instance for direct MQTT
  const pubsub = React.useMemo(() => new PubSub({ region: REGION, endpoint: 'wss://a2d1p97nzglf1y-ats.iot.us-east-1.amazonaws.com/mqtt' }), []);

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

    // 0 ▸ check for internet connectivity (block until online)
    setStatus('Checking internet connection…'); bump(0.01);
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      setStatus('No internet connection. Please connect to the internet to continue.'); bump(0.01);
      return;
    }

    // 0.5 ▸ check device heartbeat if paired
    if (liquorbotId && liquorbotId !== '000') {
      setStatus('Communicating with your LiquorBot device…'); bump(0.015);
      const ok = await checkHeartbeatOnce();
      if (ok) {
        setStatus('Device is online and ready!'); bump(0.02);
        // --- NEW: Sync device config ---
        setStatus('Syncing device configuration…'); bump(0.025);
        const slotTopic = `liquorbot/liquorbot${liquorbotId}/slot-config`;
        let configReceived = false;
        await new Promise<void>(async (resolve) => {
          const sub = pubsub.subscribe({ topics: [slotTopic] }).subscribe({
            next: async (msg) => {
              let payload = msg.value ?? msg;
              if (typeof payload === 'string') {
                try { payload = JSON.parse(payload); } catch {}
              }
              const p = payload as any;
              if (p && typeof p === 'object' && p.action === 'CURRENT_CONFIG') {
                await AsyncStorage.setItem(
                  `allowedDrinks-${liquorbotId}`,
                  JSON.stringify({
                    drinkIDs: Array.isArray(p.drinkIDs) ? p.drinkIDs : [],
                    customRecipeIDs: Array.isArray(p.customRecipeIDs) ? p.customRecipeIDs : [],
                  })
                );
                configReceived = true;
                setStatus('Device configuration loaded!'); bump(0.03);
                sub.unsubscribe();
                resolve();
              }
            },
            error: () => {
              if (!configReceived) {
                setStatus('Failed to sync device config (will retry in background)…');
                sub.unsubscribe();
                resolve();
              }
            },
          });
          // Send GET_CONFIG
          try {
            await pubsub.publish({ topics: [slotTopic], message: { action: 'GET_CONFIG' } });
          } catch {
            setStatus('Failed to request device config.');
            sub.unsubscribe();
            resolve();
          }
          // Timeout after 1.5s
          setTimeout(() => {
            if (!configReceived) {
              setStatus('Device config not received (will retry in background)…');
              sub.unsubscribe();
              resolve();
            }
          }, 1500);
        });
      } else {
        setStatus('Device not responding (will retry in background)…'); bump(0.02);
      }
    }

    // 1 ▸ clear image cache if needed
    const IMG_CACHE_VER = 1;
    const ver = await AsyncStorage.getItem('imgCacheVer');
    if (parseInt(ver ?? '0', 10) < IMG_CACHE_VER) {
      setStatus('Clearing old image cache…'); bump(0.025);
      await clearImageCache();
      await AsyncStorage.setItem('imgCacheVer', String(IMG_CACHE_VER));
    }

    // 1.5 ▸ check for first-time launch
    const [haveDrinks, haveIngs] = await AsyncStorage.multiGet(['drinksJson', 'ingredientsJson']);
    const coldStart = !(haveDrinks[1] && haveIngs[1]);
    setFirstRun(coldStart);
    if (coldStart && !online) {
      setStatus('Internet required to complete first-time setup.'); bump(0.03);
      return;
    }

    try {
      // 2 ▸ refresh Cognito session
      setStatus('Refreshing secure login…');
      const session = await fetchAuthSession({ forceRefresh: true });
      bump(0.08);

      // 3 ▸ IoT policy
      setStatus('Configuring secure IoT connection…');
      await attachIoTPolicy(); bump(0.12);

      // 4 ▸ logo + BG
      setStatus('Loading app assets…');
      await Asset.loadAsync([LOGO, require('@/assets/images/home-background.jpg')]);
      bump(0.16);

      // 5 ▸ pull JSON (or use cache when offline)
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
        return;
      }
      bump(0.22);

      // 6 ▸ cache images (signed-URL fallback)
      setStatus('Caching drink and glass images…');
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

      // 7 ▸ cache upcoming events locally (non-critical)
      setStatus('Loading your upcoming events…');
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
      bump(0.95);

      // 8 ▸ done
      if (!cancel.current) {
        setPct(1);
        setStatus('Ready!');
        retryCount.current = 0; // reset retry count on success
        if (typeof onRequestCloseWithAnimation === 'function') {
          onRequestCloseWithAnimation();
        } else {
          setTimeout(() => {
            if (modalMode && onFinish) onFinish();
            else router.replace('/(tabs)');
          }, 350);
        }
        return;
      }
    } catch (err: any) {
      if (!online) { setStatus('Connection lost – waiting…'); return; }
      throw err;
    }
  }

  /* ---------- render ---------- */
  const percent = Math.floor(pct * 100);
  const screenHeight = Dimensions.get('window').height;
  const translateY = useRef(new RNAnimated.Value(0)).current;

  // Animate overlay opacity
  const overlayOpacity = translateY.interpolate({
    inputRange: [0, screenHeight * 0.7],
    outputRange: [0.7, 0],
    extrapolate: 'clamp',
  });

  // Render just the content, centered
  return (
    <RNAnimated.View
      style={{
        flex: 1,
        transform: [{ translateY }],
        backgroundColor: '#141414',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 200,
      }}
    >
      <Image source={LOGO} style={styles.logo} resizeMode="contain" />
      <Text style={styles.app}>{APP_NAME}</Text>
      <View style={styles.barWrap}>
        <View style={StyleSheet.absoluteFill} />
        <RNAnimated.View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: progress.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }),
            overflow: 'hidden',
            backgroundColor: '#CE975E',
          }}
        />
      </View>
      <Text style={styles.percent}>{percent}%</Text>
      <Text style={styles.status}>
        {online ? status : (firstRun ? 'Internet required for first-time setup' : 'Offline mode')}
      </Text>
    </RNAnimated.View>
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
