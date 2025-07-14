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
import { fetchAuthSession, getCurrentUser } from '@aws-amplify/auth';
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

// Add stripS3Key helper and update toSigned to use it
function stripS3Key(uriOrKey: string) {
  if (!uriOrKey.startsWith('s3://')) return uriOrKey;
  // s3://bucket-name[/public]/<key>  →  <key>
  return uriOrKey.replace(/^s3:\/\/[^/]+\/(public\/)?/, '');
}

async function toSigned(remoteOrKey: string): Promise<string> {
  if (/^https?:\/\//i.test(remoteOrKey)) return remoteOrKey;
  // Handle raw S3 keys or "s3://…" URIs
  const key = stripS3Key(remoteOrKey);
  try {
    const { url } = await getUrl({
      key,
      options: { accessLevel: 'guest', expiresIn: 60 * 60 * 24 },
    });
    return url.toString();
  } catch {
    // Fall back to unsigned public path
    return `https://${config.aws_user_files_s3_bucket}.s3.${config.aws_user_files_s3_bucket_region}.amazonaws.com/public/${key}`;
  }
}

// local path helper (move here for use in getDrinkImageSource)
const getLocalPath = (id: number, remote: string) => {
  const ext = remote.split('.').pop()?.split('?')[0] || 'jpg';
  return `${FileSystem.cacheDirectory}drink-images/drink_${id}.${ext}`;
};

// Robust image download/caching logic (copied from menu page)
async function getDrinkImageSource(drink: { id: number; image: string }) {
  if (!drink.image) return { uri: '' };
  try {
    const localUri = getLocalPath(drink.id, drink.image);
    const localInfo = await FileSystem.getInfoAsync(localUri).catch(() => ({ exists: false }));
    if (localInfo.exists) return { uri: localUri };
    // Legacy filename path fallback
    const basename = drink.image.split('/').pop()?.split('?')[0] ?? '';
    const legacyUri = `${FileSystem.cacheDirectory}drink-images/${basename}`;
    const legacyInfo = await FileSystem.getInfoAsync(legacyUri).catch(() => ({ exists: false }));
    if (legacyInfo.exists) return { uri: legacyUri };
    // Download with retry logic
    let retries = 3;
    while (retries > 0) {
      try {
        const signed = await toSigned(drink.image);
        await FileSystem.makeDirectoryAsync(
          localUri.substring(0, localUri.lastIndexOf('/')),
          { intermediates: true }
        );
        await FileSystem.downloadAsync(signed, localUri);
        return { uri: localUri };
      } catch (error) {
        retries--;
        if (retries === 0) {
          console.warn(`Failed to download image for drink ${drink.id} after 3 attempts`);
          // Return the remote URL as fallback
          return { uri: await toSigned(drink.image) };
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  } catch (error) {
    console.error(`Error processing image for drink ${drink.id}:`, error);
    return { uri: '' };
  }
}

// Caches all images with progress callback (robust, batch, timeout)
async function cacheAllDrinkImages(
  drinks: { id: number; image: string }[],
  bump: (f: number) => void,
  start = 0,
  range = 1,
) {
  const total = drinks.length || 1;
  let done = 0;
  // Create a function to handle individual image caching with timeout
  const cacheImageWithTimeout = async (d: { id: number; image: string }) => {
    try {
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Image caching timeout')), 10000)
      );
      await Promise.race([
        getDrinkImageSource(d),
        timeout
      ]);
    } catch (error) {
      console.warn(`Failed to cache image for drink ${d.id}:`, error);
      // We'll continue even if some images fail
    }
  };
  // Process images in batches to avoid overwhelming the system
  const batchSize = 5;
  for (let i = 0; i < drinks.length; i += batchSize) {
    const batch = drinks.slice(i, i + batchSize);
    await Promise.allSettled(batch.map(d =>
      cacheImageWithTimeout(d).then(() => {
        done += 1;
        bump(start + (done / total) * range);
      })
    ));
  }
}

// IoT policy helper (ensure present)
async function attachIoTPolicy() {
  const { identityId, credentials } = await fetchAuthSession();
  if (!identityId) return;
  const iot = new IoTClient({ region: REGION, credentials });
  const { policies = [] } = await iot.send(
    new ListAttachedPoliciesCommand({ target: identityId }),
  );
  if (policies.some((p) => p.policyName === IOT_POLICY)) return;
  await iot.send(new AttachPolicyCommand({ policyName: IOT_POLICY, target: identityId }));
}

// fetchJsonOrCache helper (ensure present)
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

// Helper to clear the image cache directory
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

// Helper to get public S3 URL for JSON
function getPublicS3Url(key: string) {
  return `https://liquorbot-storage-8cb6bcd8a9244-dev.s3.amazonaws.com/public/${key}`;
}

/* ───────── component ───────── */
export default function SessionLoading({ modalMode, onFinish, onRequestCloseWithAnimation }: { modalMode?: boolean; onFinish?: () => void; onRequestCloseWithAnimation?: () => void } = {}) {
  const router = useRouter();
  const [pct, setPct]       = useState(0);
  const [status, setStatus] = useState('Starting…');
  const [online, setOnline] = useState<boolean>(true);
  const [firstRun, setFirstRun] = useState<boolean>(false); // true ⇢ no cached JSON yet
  const [providerReady, setProviderReady] = useState(false);
  const [checkingUser, setCheckingUser] = useState(true); // NEW: track user check
  const progress = useRef(new RNAnimated.Value(0)).current;
  const cancel   = useRef<boolean>(false);                  // abort flag
  const retryCount = useRef<number>(0);                    // retry counter
  const maxRetries = 5;

  const liquorBotCtx = useLiquorBot();
  const { liquorbotId, setLiquorbotId, isConnected, forceDisconnect } = liquorBotCtx;

  const bump = (f: number) => setPct(p => Math.min(f, 1));

  // PubSub instance for direct MQTT
  const pubsub = React.useMemo(() => new PubSub({ region: REGION, endpoint: 'wss://a2d1p97nzglf1y-ats.iot.us-east-1.amazonaws.com/mqtt' }), []);

  // One-off heartbeat check for session loading
  async function checkHeartbeatOnce(liquorbotId: string): Promise<boolean> {
    try {
      if (!liquorbotId || liquorbotId === '000') {
        return false;
      }
      const topic = `liquorbot/liquorbot${liquorbotId}/heartbeat`;
      let responded = false;
      let sub: { unsubscribe: () => void } | null = null;
      return new Promise(async (resolve) => {
        const handler = () => {
          responded = true;
          resolve(true);
          sub && sub.unsubscribe();
        };
        const errorHandler = (err: any) => {
          if (!responded) {
            resolve(false);
            sub && sub.unsubscribe();
          }
        };
        sub = pubsub.subscribe({ topics: [topic] }).subscribe({ next: handler, error: errorHandler });
        // Wait a tick to ensure subscription is active (AWS IoT quirk)
        setTimeout(async () => {
          try {
            const msg = { action: 'HEARTBEAT_CHECK' };
            await pubsub.publish({ topics: [topic], message: msg });
          } catch (err) {
            if (sub) sub.unsubscribe();
            resolve(false);
            return;
          }
        }, 100); // 100ms delay
        setTimeout(() => {
          if (!responded) {
            resolve(false);
            if (sub) sub.unsubscribe();
          }
        }, 1000);
      });
    } catch (err) {
      return false;
    }
  }

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

  // Watch for provider readiness
  useEffect(() => {
    // console.log('[DEBUG] providerReady effect, isAdmin:', liquorBotCtx.isAdmin, 'liquorbotId:', liquorbotId);
    if (liquorBotCtx.isAdmin) {
      if (liquorbotId && liquorbotId !== '000') {
        // console.log('[DEBUG] providerReady effect: valid admin liquorbotId, resetting pct to 0');
        setPct(0);
        setProviderReady(true);
      } else {
        setProviderReady(false);
      }
    } else {
      setProviderReady(true);
    }
  }, [liquorbotId, liquorBotCtx.isAdmin]);

  // Remove all liquorbotId checks for admin/non-admin
  useEffect(() => {
    console.log('[SessionLoading] isAdmin:', liquorBotCtx.isAdmin, 'liquorbotId:', liquorbotId);
    setProviderReady(true);
  }, [liquorbotId, liquorBotCtx.isAdmin]);

  // Check for signed-in user on mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        console.log('[SessionLoading] Checking for current user...');
        await getCurrentUser();
        if (isMounted) {
          console.log('[SessionLoading] User found, continuing.');
          setCheckingUser(false);
        }
      } catch (err) {
        console.log('[SessionLoading] No user found or error:', err);
        if (isMounted) {
          setCheckingUser(false);
          router.replace('/'); // Go to home/index page
        }
      }
    })();
    return () => { isMounted = false; };
  }, []);

  // Only run bootstrap when providerReady is true
  useEffect(() => {
    if (checkingUser) { console.log('[SessionLoading] Waiting for user check...'); return; }
    if (!providerReady) { console.log('[SessionLoading] Provider not ready...'); return; }
    let retryTimeout: NodeJS.Timeout | null = null;
    const runBootstrap = () => {
      console.log('[SessionLoading] runBootstrap called, pct:', pct, 'online:', online);
      if (!online) {
        console.log('[SessionLoading] Offline, waiting for connection.');
        return;
      }
      if (pct > 0 && pct < 0.99) {
        console.log('[SessionLoading] Progress in progress, skipping.');
        return;
      }
      setPct(0);
      console.log('[SessionLoading] Calling bootstrap...');
      bootstrap().catch(err => {
        console.warn('[SessionLoading] bootstrap error →', err);
        setStatus('Unexpected error – retrying…');
        if (retryCount.current < maxRetries) {
          const delay = Math.min(2000 * Math.pow(2, retryCount.current), 20000); // exponential backoff, max 20s
          retryCount.current += 1;
          retryTimeout = setTimeout(runBootstrap, delay);
        } else {
          setStatus('Failed to load after several attempts. Please restart the app.');
          if (typeof onRequestCloseWithAnimation === 'function') {
            onRequestCloseWithAnimation();
          } else if (modalMode && typeof onFinish === 'function') {
            onFinish();
          } else {
            router.replace('/');
          }
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
  }, [online, providerReady, liquorbotId, checkingUser]);

  /* --------------- main bootstrap --------------- */
  async function bootstrap(): Promise<void> {
    console.log('[SessionLoading] bootstrap called, liquorbotId:', liquorbotId);
    cancel.current = false;
    setStatus('Checking internet connection…'); bump(0.01);
    const netState = await NetInfo.fetch();
    console.log('[SessionLoading] NetInfo:', netState);
    if (!netState.isConnected) {
      setStatus('No internet connection. Please connect to the internet to continue.'); bump(0.01);
      return;
    }
    if (liquorbotId && liquorbotId !== '000') {
      setStatus('Communicating with your LiquorBot device…'); bump(0.015);
      console.log('[SessionLoading] About to call checkHeartbeatOnce with', liquorbotId);
      const ok = await checkHeartbeatOnce(liquorbotId);
      console.log('[SessionLoading] checkHeartbeatOnce returned', ok);
      if (ok) {
        setStatus('Device is online and ready!'); bump(0.02);
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
            error: (err) => {
              if (!configReceived) {
                setStatus('Failed to sync device config (will retry in background)…');
                console.warn('[SessionLoading] Device config error:', err);
                sub.unsubscribe();
                resolve();
              }
            },
          });
          try {
            const msg = { action: 'GET_CONFIG' };
            await pubsub.publish({ topics: [slotTopic], message: msg });
          } catch (err) {
            setStatus('Failed to request device config.');
            console.warn('[SessionLoading] Failed to request device config:', err);
            sub.unsubscribe();
            resolve();
          }
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
        console.warn('[SessionLoading] Device not responding.');
      }
    }
    const IMG_CACHE_VER = 1;
    const ver = await AsyncStorage.getItem('imgCacheVer');
    console.log('[SessionLoading] imgCacheVer:', ver);
    if (parseInt(ver ?? '0', 10) < IMG_CACHE_VER) {
      setStatus('Clearing old image cache…'); bump(0.025);
      await clearImageCache();
      await AsyncStorage.setItem('imgCacheVer', String(IMG_CACHE_VER));
      console.log('[SessionLoading] Cleared image cache.');
    }
    const [haveDrinks, haveIngs] = await AsyncStorage.multiGet(['drinksJson', 'ingredientsJson']);
    const coldStart = !(haveDrinks[1] && haveIngs[1]);
    setFirstRun(coldStart);
    console.log('[SessionLoading] coldStart:', coldStart, 'online:', online);
    if (coldStart && !online) {
      setStatus('Internet required to complete first-time setup.'); bump(0.03);
      return;
    }
    try {
      setStatus('Refreshing secure login…');
      console.log('[SessionLoading] Calling fetchAuthSession...');
      const session = await fetchAuthSession({ forceRefresh: true });
      console.log('[SessionLoading] fetchAuthSession result:', session);
      bump(0.08);
      setStatus('Configuring secure IoT connection…');
      console.log('[SessionLoading] Attaching IoT policy...');
      await attachIoTPolicy(); bump(0.12);
      setStatus('Loading app assets…');
      await Asset.loadAsync([LOGO, require('@/assets/images/home-background.jpg')]);
      bump(0.16);
      let drinksRaw = haveDrinks[1] ?? '';
      let ingsRaw   = haveIngs[1]   ?? '';
      if (online) {
        setStatus('Checking for menu updates…');
        try {
          const dUrl = getPublicS3Url('drinkMenu/drinks.json');
          const iUrl = getPublicS3Url('drinkMenu/ingredients.json');
          const [dRes, iRes] = await Promise.all([
            fetch(dUrl),
            fetch(iUrl),
          ]);
          const [dTxt, iTxt] = await Promise.all([
            dRes.ok ? dRes.text() : drinksRaw,
            iRes.ok ? iRes.text() : ingsRaw,
          ]);
          if (dTxt && dTxt !== drinksRaw) {
            drinksRaw = dTxt;
            await AsyncStorage.setItem('drinksJson', drinksRaw);
          }
          if (iTxt && iTxt !== ingsRaw) {
            ingsRaw = iTxt;
            await AsyncStorage.setItem('ingredientsJson', ingsRaw);
          }
          console.log('[SessionLoading] Menu JSON loaded.');
        } catch (err) {
          console.warn('[SessionLoading] Menu JSON fetch error →', err);
          if (!drinksRaw || !ingsRaw) {
            setStatus('Failed to load menu JSON. Check your internet connection.');
            throw err;
          } else {
            setStatus('Using cached menu…');
          }
        }
      } else if (!drinksRaw || !ingsRaw) {
        setStatus('Internet required – retrying…');
        return;
      }
      bump(0.22);
      if (!drinksRaw) throw new Error('No drinks JSON available');
      if (!ingsRaw) throw new Error('No ingredients JSON available');
      setStatus('Caching drink and glass images…');
      const drinks = JSON.parse(drinksRaw) as { id:number; image:string }[];
      const glassKeys = [
        'drinkMenu/drinkPictures/rocks_white.png',
        'drinkMenu/drinkPictures/highball_white.png',
        'drinkMenu/drinkPictures/martini_white.png',
        'drinkMenu/drinkPictures/coupe_white.png',
        'drinkMenu/drinkPictures/margarita_white.png',
      ];
      const glassDesc = glassKeys.map((k, idx) => ({
        id: 10_000 + idx,
        image: k
      }));
      await cacheAllDrinkImages([...drinks, ...glassDesc], bump, 0.22, 0.68);
      console.log('[SessionLoading] Images cached.');
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
      } catch (err) {
        console.warn('[SessionLoading] Failed to load events:', err);
      }
      bump(0.90);
      setStatus('Preloading events and calendar…');
      try {
        const cached = await AsyncStorage.getItem('cachedEvents');
        if (cached) {
          JSON.parse(cached);
        }
      } catch (err) {
        console.warn('[SessionLoading] Failed to preload events:', err);
      }
      bump(0.95);
      await AsyncStorage.setItem('sessionLoaded', 'true');
      if (!cancel.current) {
        setPct(1);
        setStatus('Ready!');
        retryCount.current = 0;
        console.log('[SessionLoading] Session loading complete.');
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
      console.warn('[SessionLoading] Bootstrap error:', err);
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
  // Always show the loading UI, even while checkingUser
  return (
    <RNAnimated.View
      style={{
        flex: 1,
        transform: [{ translateY }],
        backgroundColor: 'rgba(20,20,20,0)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 200,
      }}
    >
      <Image source={LOGO} style={styles.logo} resizeMode="contain" />
      <Text style={styles.app}>{APP_NAME}</Text>
      <View style={[styles.barWrap, online ? null : { borderColor: '#D9534F', borderWidth: 2 }]}> {/* Red outline if offline */}
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
            backgroundColor: online ? '#CE975E' : '#D9534F', // Red bar if offline
          }}
        />
      </View>
      <Text style={styles.percent}>{percent}%</Text>
      <Text style={styles.status}>
        {online
          ? status
          : (firstRun
              ? 'Internet required for setup.'
              : 'Offline mode.\n\nPlease connect to the Internet to use the app.\n\nRetrying connection…')}
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
