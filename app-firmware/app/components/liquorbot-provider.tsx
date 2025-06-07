// -----------------------------------------------------------------------------
// File: liquorbot-provider.tsx        (REPLACEMENT – 07 Jun 2025 • v6)
// Purpose:
//   •  Same as before *plus*
//      –   Immediately clears heartbeat + connection state when the ID changes
//      –   Skips MQTT subscriptions if the ID is "000"
//      –   Exposes a `hardReset()` helper (forceDisconnect + setLiquorbotId('000'))
// -----------------------------------------------------------------------------
import React, {
  createContext, useState, useEffect, useContext, ReactNode,
  useRef, useCallback, useMemo,
} from 'react';
import { Amplify }               from 'aws-amplify';
import { Hub }                   from 'aws-amplify/utils';
import { PubSub }                from '@aws-amplify/pubsub';
import { fetchAuthSession }      from '@aws-amplify/auth';
import AsyncStorage              from '@react-native-async-storage/async-storage';
import config                    from '../../src/amplifyconfiguration.json';

Amplify.configure(config);

/* ───────── constants ───────── */
const REGION          = 'us-east-1';
const ENDPOINT        = 'wss://a2d1p97nzglf1y-ats.iot.us-east-1.amazonaws.com/mqtt';
const HB_TIMEOUT_MS   = 7_000;
const WATCHDOG_MS     = 1_000;
const NO_HB_RECONNECT = 15_000;

/* user-scoped storage helper */
const DEVICE_KEY = (uid: string) => `@LiquorBot:lastDevice:${uid}`;

/* ───────── ctx types ───────── */
interface LiquorBotContextValue {
  isConnected        : boolean;
  slots              : number[];
  liquorbotId        : string;
  /* actions */
  setLiquorbotId     : (id: string) => void;
  forceDisconnect    : () => void;
  hardReset          : () => void;
  updateSlots        : (s: number[]) => void;
  reconnect          : () => void;
  /* auth / role */
  groups             : string[];
  isAdmin            : boolean;
  /* event-override helpers */
  temporaryOverrideId: (id: string, revertAt: Date) => void;
  restorePreviousId  : () => void;
  isOverridden       : boolean;
  clearPrevLiquorbotId: () => void;
}

const LiquorBotContext = createContext<LiquorBotContextValue>({} as any);

/* ───────── provider ───────── */
export function LiquorBotProvider({ children }: { children: ReactNode }) {
  const pubsub = useMemo(() => new PubSub({ region: REGION, endpoint: ENDPOINT }), []);

  /* ---------------- USER / ROLE STATE ---------------- */
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [groups,       setGroups]     = useState<string[]>([]);
  const isAdmin = groups.includes('ADMIN');

  const refreshAuthInfo = useCallback(async () => {
    try {
      const ses = await fetchAuthSession();
      const uid = ses.tokens?.idToken?.payload?.['cognito:username'];
      const gs  = ses.tokens?.idToken?.payload?.['cognito:groups'] ?? [];
      setCurrentUser(typeof uid === 'string' ? uid : null);
      setGroups(Array.isArray(gs) ? gs.filter((g): g is string => typeof g === 'string') : []);
    } catch {
      setCurrentUser(null);
      setGroups([]);
    }
  }, []);

  /* ---------------- DEVICE ID STATE ---------------- */
  const [liquorbotId, setIdState] = useState('000');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  /* last-known heartbeat */
  const lastHb     = useRef(0);
  const resetHb    = () => { lastHb.current = 0; };

  /* connection flag & slot map */
  const [isConnected, setIsConnected] = useState(false);
  const [slots,       setSlots]       = useState<number[]>(Array(15).fill(0));

  /* bump-tick to force resubscribe */
  const [tick, setTick] = useState(0);
  const reconnect       = useCallback(() => setTick(t => t + 1), []);

  /* ---------------- helper: persist pairing ---------------- */
  const persistDeviceId = useCallback(async (uid: string, id: string) => {
    if (id === '000') {
      await AsyncStorage.removeItem(DEVICE_KEY(uid));
    } else {
      await AsyncStorage.setItem(DEVICE_KEY(uid), id);
    }
  }, []);

  /* ---------------- setLiquorbotId (patched) ---------------- */
  const setLiquorbotId = useCallback(async (id: string) => {
    /* 1️⃣  immediately clear connection state */
    resetHb();
    setIsConnected(false);

    /* 2️⃣  update the in-memory ID */
    setIdState(id);

    /* 3️⃣  persist or wipe stored pairing */
    if (currentUser) {
      if (isAdmin)      await persistDeviceId(currentUser, id);
      else              await AsyncStorage.removeItem(DEVICE_KEY(currentUser));
    }
    /* 4️⃣  re-subscribe to the correct topics */
    reconnect();
  }, [currentUser, isAdmin, persistDeviceId, reconnect]);

  /* quick helper you can import anywhere */
  const forceDisconnect = useCallback(() => {
    resetHb();
    setIsConnected(false);
  }, []);

  const hardReset = useCallback(() => {
    forceDisconnect();
    setLiquorbotId('000');
  }, [forceDisconnect, setLiquorbotId]);

  /* ---------------- LOAD persisted ID when user changes ---------------- */
  useEffect(() => {
    if (!currentUser) { setIdState('000'); return; }
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(DEVICE_KEY(currentUser));
        if (saved) setIdState(saved);
      } catch {}
    })();
  }, [currentUser]);

  /* ---------------- AUTH LISTENER ---------------- */
  useEffect(() => {
    refreshAuthInfo();               // initial

    const unsub = Hub.listen('auth', ({ payload }: { payload: { event: string } }) => {
      if (['signedIn', 'tokenRefresh'].includes(payload.event)) {
        setIsAuthenticated(true);
        refreshAuthInfo();
        reconnect();
      } else if (payload.event === 'signedOut') {
        /* guests lose pairing on sign-out */
        if (currentUser && !isAdmin) AsyncStorage.removeItem(DEVICE_KEY(currentUser)).catch(() => {});
        setIsAuthenticated(false);
        setCurrentUser(null);
        setGroups([]);
        hardReset();
      }
    });
    return () => unsub();
  }, [currentUser, isAdmin, hardReset, reconnect, refreshAuthInfo]);

  /* ---------------- mqtt subscribe helper ---------------- */
  const subscribeTopic = useCallback((
    topic: string,
    onMsg: (m: any) => void,
    onErr: (e: any)  => void,
  ) => {
    /* guard: skip fake “000” ID */
    if (!isAuthenticated || liquorbotId === '000') return () => {};
    let sub: { unsubscribe: () => void } | null = null;

    fetchAuthSession({ forceRefresh: false })
      .then(() => {
        sub = pubsub.subscribe({ topics: [topic] })
          .subscribe({ next: onMsg, error: onErr });
      })
      .catch(err => { if (err?.name !== 'NotAuthorizedException') onErr(err); });

    return () => sub?.unsubscribe();
  }, [isAuthenticated, liquorbotId, pubsub]);

  /* ---------------- SLOT CONFIG ---------------- */
  useEffect(() => {
    if (!isAuthenticated || liquorbotId === '000') { setSlots(Array(15).fill(0)); return; }

    const topic  = `liquorbot/liquorbot${liquorbotId}/slot-config`;
    const cancel = subscribeTopic(
      topic,
      (d: any) => {
        const msg = d.value ?? d;
        if (msg.action === 'CURRENT_CONFIG' && Array.isArray(msg.slots)) {
          setSlots(msg.slots.map((n: any) => Number(n) || 0));
        }
        if (msg.action === 'SET_SLOT' && typeof msg.slot === 'number') {
          setSlots(p => {
            const arr = [...p];
            arr[msg.slot - 1] = Number(msg.ingredientId) || 0;
            return arr;
          });
        }
      },
      () => setTimeout(reconnect, 5_000),
    );
    return cancel;
  }, [liquorbotId, tick, subscribeTopic, isAuthenticated, reconnect]);

  /* ---------------- HEARTBEAT ---------------- */
  useEffect(() => {
    if (!isAuthenticated || liquorbotId === '000') { resetHb(); setIsConnected(false); return; }

    const topic  = `liquorbot/liquorbot${liquorbotId}/heartbeat`;
    const cancel = subscribeTopic(
      topic,
      () => { lastHb.current = Date.now(); },
      ()  => setTimeout(reconnect, 5_000),
    );
    return cancel;
  }, [liquorbotId, tick, subscribeTopic, isAuthenticated, reconnect]);

  /* watchdog – runs every 1 s */
  useEffect(() => {
    if (!isAuthenticated) return;
    const id = setInterval(() => {
      const alive = Date.now() - lastHb.current < HB_TIMEOUT_MS;
      setIsConnected(p => (p === alive ? p : alive));
      if (!alive && Date.now() - lastHb.current > NO_HB_RECONNECT) reconnect();
    }, WATCHDOG_MS);
    return () => clearInterval(id);
  }, [reconnect, isAuthenticated]);

  /* ---------------- updateSlots (publishes changes) ---------------- */
  const updateSlots = useCallback((newSlots: number[]) => {
    setSlots(newSlots);
    if (!isAuthenticated || liquorbotId === '000') return;
    const topic = `liquorbot/liquorbot${liquorbotId}/slot-config`;
    pubsub.publish({ topics: [topic], message: { action: 'CURRENT_CONFIG', slots: newSlots } })
      .catch(console.error);
  }, [liquorbotId, isAuthenticated, pubsub]);

  /* ───────── event-override helpers (unchanged) ───────── */
  const [prevLiquorbotId, setPrevLiquorbotId] = useState<string | null>(null);
  const clearPrevLiquorbotId = useCallback(() => setPrevLiquorbotId(null), []);
  const restorePreviousId    = useCallback(() => {
    if (prevLiquorbotId) { setLiquorbotId(prevLiquorbotId); setPrevLiquorbotId(null); }
  }, [prevLiquorbotId, setLiquorbotId]);

  const temporaryOverrideId = useCallback((newId: string, revertAt: Date) => {
    if (newId === liquorbotId) return;
    setPrevLiquorbotId(p => p ?? liquorbotId);
    setLiquorbotId(newId);
    const ms = revertAt.getTime() - Date.now();
    if (ms > 0) setTimeout(restorePreviousId, ms);
  }, [liquorbotId, restorePreviousId, setLiquorbotId]);

  const isOverridden = useMemo(() => prevLiquorbotId !== null, [prevLiquorbotId]);

  /* ---------------- CONTEXT VALUE ---------------- */
  const value = useMemo<LiquorBotContextValue>(() => ({
    /* state */
    isConnected, slots, liquorbotId,
    /* actions */
    setLiquorbotId, forceDisconnect, hardReset, updateSlots, reconnect,
    /* auth */
    groups, isAdmin,
    /* overrides */
    temporaryOverrideId, restorePreviousId, isOverridden, clearPrevLiquorbotId,
  }), [
    isConnected, slots, liquorbotId,
    setLiquorbotId, forceDisconnect, hardReset, updateSlots, reconnect,
    groups, isAdmin, temporaryOverrideId, restorePreviousId, isOverridden, clearPrevLiquorbotId,
  ]);

  return <LiquorBotContext.Provider value={value}>{children}</LiquorBotContext.Provider>;
}

/* ---------- hook ---------- */
export function useLiquorBot() {
  return useContext(LiquorBotContext);
}
