// -----------------------------------------------------------------------------
// File: liquorbot-provider.tsx            (REPLACEMENT – 27 May 2025 • v3)
// Purpose:
//   • Eliminate “Unauthenticated access is not supported…” spam while logged-out
//   • Still reconnect automatically as soon as a user signs in / tokens refresh
// -----------------------------------------------------------------------------

import React, {
  createContext, useState, useEffect, useContext, ReactNode,
  useRef, useCallback, useMemo,
} from 'react';
import { Amplify }           from 'aws-amplify';
import { Hub }               from 'aws-amplify/utils';
import { PubSub }            from '@aws-amplify/pubsub';
import { fetchAuthSession }  from '@aws-amplify/auth';
import AsyncStorage          from '@react-native-async-storage/async-storage';
import config                from '../../src/amplifyconfiguration.json';

Amplify.configure(config);

/* ───────── constants ───────── */
const REGION            = 'us-east-1';
const ENDPOINT          = 'wss://a2d1p97nzglf1y-ats.iot.us-east-1.amazonaws.com/mqtt';
const HB_TIMEOUT_MS     = 7_000;
const WATCHDOG_MS       = 1_000;
const NO_HB_RECONNECT   = 15_000;

const pubsub = new PubSub({ region: REGION, endpoint: ENDPOINT });

/* ───────── ctx types ───────── */
interface LiquorBotContextValue {
  isConnected    : boolean;
  slots          : number[];
  liquorbotId    : string;
  forceDisconnect: () => void;
  updateSlots    : (s:number[]) => void;
  setLiquorbotId : (id:string)=>void;
  reconnect      : () => void;
  groups         : string[];
  isAdmin        : boolean;
}
const LiquorBotContext = createContext<LiquorBotContextValue>({} as any);

/* ───────── helpers ───────── */
async function cachedGroups(): Promise<string[]> {
  const KEY = 'userGroups';
  const cached = await AsyncStorage.getItem(KEY);
  if (cached) return JSON.parse(cached);

  try {
    const ses  = await fetchAuthSession();
    const raw  = ses.tokens?.idToken?.payload?.['cognito:groups'] ?? [];
    const grps = Array.isArray(raw) ? raw.filter((g):g is string => typeof g === 'string') : [];
    await AsyncStorage.setItem(KEY, JSON.stringify(grps));
    return grps;
  } catch {
    return [];                               // unauthenticated → no groups
  }
}

/* ───────── provider ───────── */
export function LiquorBotProvider({ children }:{ children:ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [slots,        setSlots]      = useState<number[]>(Array(15).fill(0));
  const [liquorbotId,  setIdState]    = useState('000');

  /* persist LiquorBot-ID */
  useEffect(() => {
    AsyncStorage.getItem('liquorbotId')
      .then(v => v && setIdState(v))
      .catch(console.warn);
  }, []);
  const setLiquorbotId = useCallback(async(id:string) => {
    setIdState(id);
    try { await AsyncStorage.setItem('liquorbotId', id); } catch {}
    reconnect();
  }, []);

  /* groups */
  const [groups, setGroups] = useState<string[]>([]);
  const syncGroups = useCallback(() => cachedGroups().then(setGroups).catch(() => setGroups([])), []);
  useEffect(() => { syncGroups(); }, [syncGroups]);
  const isAdmin = groups.includes('ADMIN');

  /* reconnect orchestration */
  const lastHb = useRef(0);
  const [tick, setTick] = useState(0);
  const reconnect       = useCallback(() => setTick(t => t + 1), []);
  const forceDisconnect = useCallback(() => { lastHb.current = 0; setIsConnected(false); }, []);

  /* Hub – respond to auth events */
  useEffect(() => {
    const off = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signedIn' || payload.event === 'tokenRefresh') {
        syncGroups(); reconnect();
      } else if (payload.event === 'signedOut') {
        forceDisconnect(); setGroups([]); AsyncStorage.removeItem('userGroups').catch(() => {});
      }
    });
    return () => off();
  }, [reconnect, forceDisconnect, syncGroups]);

  /* guarded subscribe – SKIPS when creds aren’t ready, so no NotAuthorized spam */
  const subscribeTopic = useCallback(
    (topic:string,
     onMsg:(m:any)=>void,
     onErr:(e:any)=>void) => {
      let sub: { unsubscribe: () => void } | null = null;

      fetchAuthSession({ forceRefresh:false })
        .then(() =>
          pubsub.subscribe({ topics:[topic] })
                .subscribe({ next:onMsg, error:onErr }),
        )
        .then(s => { sub = s; })
        .catch(err => {
          // Silence unauthenticated noise; everything re-tries after sign-in.
          if (err?.name !== 'NotAuthorizedException' &&
              err?.code !== 'NotAuthorizedException') {
            onErr(err);
          }
        });

      return () => sub?.unsubscribe();        // cleanup fn
    },
    [],
  );

  /* slot-config */
  useEffect(() => {
    const topic = `liquorbot/liquorbot${liquorbotId}/slot-config`;
    const cancel = subscribeTopic(
      topic,
      (d:any) => {
        const msg = (d as any).value ?? d;
        if (msg.action === 'CURRENT_CONFIG' && Array.isArray(msg.slots))
          setSlots(msg.slots.map((n:any)=>Number(n)||0));
        if (msg.action === 'SET_SLOT' && typeof msg.slot === 'number')
          setSlots(p => { const n=[...p]; n[msg.slot-1] = Number(msg.ingredientId)||0; return n; });
      },
      /* onErr ⇒ just schedule a reconnect later */
      () => { setTimeout(reconnect, 5_000); },
    );
    return cancel;
  }, [liquorbotId, tick, subscribeTopic]);

  /* heartbeat */
  useEffect(() => {
    const topic = `liquorbot/liquorbot${liquorbotId}/heartbeat`;
    const cancel = subscribeTopic(
      topic,
      () => { lastHb.current = Date.now(); },
      () => { setTimeout(reconnect, 5_000); },
    );
    return cancel;
  }, [liquorbotId, tick, subscribeTopic]);

  /* watchdog */
  useEffect(() => {
    const id = setInterval(() => {
      const alive = Date.now() - lastHb.current < HB_TIMEOUT_MS;
      setIsConnected(p => (p === alive ? p : alive));
      if (!alive && Date.now() - lastHb.current > NO_HB_RECONNECT) reconnect();
    }, WATCHDOG_MS);
    return () => clearInterval(id);
  }, [reconnect]);

  /* push updates */
  const updateSlots = useCallback((newSlots:number[]) => {
    setSlots(newSlots);
    const topic = `liquorbot/liquorbot${liquorbotId}/slot-config`;
    pubsub.publish({ topics:[topic], message:{ action:'CURRENT_CONFIG', slots:newSlots } })
          .catch(console.error);
  }, [liquorbotId]);

  const value = useMemo<LiquorBotContextValue>(() => ({
    isConnected, slots, liquorbotId,
    forceDisconnect, updateSlots, setLiquorbotId, reconnect,
    groups, isAdmin,
  }), [isConnected, slots, liquorbotId,
       forceDisconnect, updateSlots, setLiquorbotId,
       reconnect, groups, isAdmin]);

  return (
    <LiquorBotContext.Provider value={value}>
      {children}
    </LiquorBotContext.Provider>
  );
}

export function useLiquorBot() { return useContext(LiquorBotContext); }
