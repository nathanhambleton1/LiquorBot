// -----------------------------------------------------------------------------
// File: liquorbot-provider.tsx            (UPDATED – 05 Jun 2025 • v4)
// Purpose:
//   • Eliminate “Unauthenticated access is not supported…” spam while logged-out
//   • Still reconnect automatically as soon as a user signs in / tokens refresh
//   • Support “leave event & disconnect” logic (clear override + backup)
// -----------------------------------------------------------------------------


import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  ReactNode,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { Amplify }           from 'aws-amplify';
import { Hub }               from 'aws-amplify/utils';
import { PubSub }            from '@aws-amplify/pubsub';
import { fetchAuthSession }  from '@aws-amplify/auth';
import AsyncStorage          from '@react-native-async-storage/async-storage';
import config                from '../../src/amplifyconfiguration.json';

Amplify.configure(config);

/* ───────── constants ───────── */
const REGION          = 'us-east-1';
const ENDPOINT        = 'wss://a2d1p97nzglf1y-ats.iot.us-east-1.amazonaws.com/mqtt';
const HB_TIMEOUT_MS   = 7_000;
const WATCHDOG_MS     = 1_000;
const NO_HB_RECONNECT = 15_000;

const pubsub = new PubSub({ region: REGION, endpoint: ENDPOINT });

/* ───────── ctx types ───────── */
interface LiquorBotContextValue {
  isConnected        : boolean;
  slots              : number[];
  liquorbotId        : string;
  forceDisconnect    : () => void;
  updateSlots        : (s: number[]) => void;
  setLiquorbotId     : (id: string) => void;
  reconnect          : () => void;
  groups             : string[];
  isAdmin            : boolean;
  temporaryOverrideId: (id: string, revertAt: Date) => void;
  restorePreviousId  : () => void;
  isOverridden       : boolean;
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
    const grps = Array.isArray(raw) ? raw.filter((g): g is string => typeof g === 'string') : [];
    await AsyncStorage.setItem(KEY, JSON.stringify(grps));
    return grps;
  } catch {
    return [];  // unauthenticated → no groups
  }
}

/* ───────── provider ───────── */
export function LiquorBotProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [slots,        setSlots]      = useState<number[]>(Array(15).fill(0));
  const [liquorbotId,  setIdState]    = useState('000');

  /* persist LiquorBot-ID */
  useEffect(() => {
    AsyncStorage.getItem('liquorbotId')
      .then(v => {
        if (v) setIdState(v);
      })
      .catch(console.warn);
  }, []);

  const reconnect = useCallback(() => setTick(t => t + 1), []);
  const forceDisconnect = useCallback(() => {
    lastHb.current = 0;
    setIsConnected(false);
  }, []);

  // ── Modified setLiquorbotId: when id==='000', also clear override + backup
  const setLiquorbotId = useCallback(
    async (id: string) => {
      if (id === '000') {
        // clear any pending override so restorePreviousId() cannot snap back
        setPrevLiquorbotId(null);
        forceDisconnect();
      }
      setIdState(id);
      try {
        await AsyncStorage.setItem('liquorbotId', id);
      } catch {}
      reconnect();
    },
    [forceDisconnect, reconnect]
  );

  /* groups */
  const [groups, setGroups] = useState<string[]>([]);
  const syncGroups = useCallback(() => {
    cachedGroups()
      .then(setGroups)
      .catch(() => setGroups([]));
  }, []);
  useEffect(() => {
    syncGroups();
  }, [syncGroups]);
  const isAdmin = groups.includes('ADMIN');

  /* reconnect orchestration */
  const lastHb = useRef(0);
  const [tick, setTick] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const session = await fetchAuthSession();
        setIsAuthenticated(!!session.tokens?.accessToken);
      } catch {
        setIsAuthenticated(false);
      }
    };

    // Check initial auth state
    checkAuth();

    // Listen for auth changes
    const listener = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signedIn' || payload.event === 'tokenRefresh') {
        setIsAuthenticated(true);
        syncGroups();
        reconnect();
      } else if (payload.event === 'signedOut') {
        setIsAuthenticated(false);
        forceDisconnect();
        setGroups([]);
        AsyncStorage.removeItem('userGroups').catch(() => {});
      }
    });

    return () => listener();
  }, [forceDisconnect, reconnect, syncGroups]);

  /* Hub – respond to auth events */
  useEffect(() => {
    const off = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signedIn' || payload.event === 'tokenRefresh') {
        syncGroups();
        reconnect();
      } else if (payload.event === 'signedOut') {
        forceDisconnect();
        setGroups([]);
        AsyncStorage.removeItem('userGroups').catch(() => {});
      }
    });
    return () => off();
  }, [forceDisconnect, reconnect, syncGroups]);

  /* guarded subscribe – SKIPS when not authenticated */
  const subscribeTopic = useCallback(
    (topic: string,
     onMsg: (m: any) => void,
     onErr: (e: any) => void) => {
      if (!isAuthenticated) {
        console.log('[IoT] Skipping subscribe - not authenticated');
        return () => {};
      }

      let sub: { unsubscribe: () => void } | null = null;

      fetchAuthSession({ forceRefresh: false })
        .then(() => {
          const observable = pubsub.subscribe({ topics: [topic] });
          sub = observable.subscribe({ next: onMsg, error: onErr });
        })
        .catch(err => {
          if (
            err?.name !== 'NotAuthorizedException' &&
            err?.code !== 'NotAuthorizedException'
          ) {
            onErr(err);
          }
        });

      return () => sub?.unsubscribe();
    },
    [isAuthenticated]
  );

  /* slot-config - only when authenticated */
  useEffect(() => {
    if (!isAuthenticated) {
      console.log('[IoT] Skipping slot config - not authenticated');
      setSlots(Array(15).fill(0));
      return;
    }

    const topic = `liquorbot/liquorbot${liquorbotId}/slot-config`;
    const cancel = subscribeTopic(
      topic,
      (d: any) => {
        const msg = (d as any).value ?? d;
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
      () => setTimeout(reconnect, 5_000)
    );
    return cancel;
  }, [liquorbotId, tick, subscribeTopic, isAuthenticated]);

  /* heartbeat - only when authenticated */
  useEffect(() => {
    if (!isAuthenticated) {
      console.log('[IoT] Skipping heartbeat - not authenticated');
      lastHb.current = 0;
      setIsConnected(false);
      return;
    }

    const topic = `liquorbot/liquorbot${liquorbotId}/heartbeat`;
    const cancel = subscribeTopic(
      topic,
      () => {
        lastHb.current = Date.now();
      },
      () => {
        setTimeout(reconnect, 5_000);
      }
    );
    return cancel;
  }, [liquorbotId, tick, subscribeTopic, isAuthenticated]);

  /* watchdog - only when authenticated */
  useEffect(() => {
    if (!isAuthenticated) return;

    const id = setInterval(() => {
      const alive = Date.now() - lastHb.current < HB_TIMEOUT_MS;
      setIsConnected(p => (p === alive ? p : alive));
      if (!alive && Date.now() - lastHb.current > NO_HB_RECONNECT) {
        reconnect();
      }
    }, WATCHDOG_MS);
    return () => clearInterval(id);
  }, [reconnect, isAuthenticated]);

  /* push updates - only when authenticated */
  const updateSlots = useCallback(
    (newSlots: number[]) => {
      setSlots(newSlots);

      if (!isAuthenticated) {
        console.log('[IoT] Skipping slot update - not authenticated');
        return;
      }

      const topic = `liquorbot/liquorbot${liquorbotId}/slot-config`;
      pubsub
        .publish({
          topics: [topic],
          message: { action: 'CURRENT_CONFIG', slots: newSlots },
        })
        .catch(console.error);
    },
    [liquorbotId, isAuthenticated]
  );

  /* ───────── event-override helpers ───────── */
  const [prevLiquorbotId, setPrevLiquorbotId] = useState<string | null>(null);

  const restorePreviousId = useCallback(() => {
    if (prevLiquorbotId) {
      setIdState(prevLiquorbotId);
      setPrevLiquorbotId(null);
      reconnect();
    }
  }, [prevLiquorbotId, reconnect]);

  const temporaryOverrideId = useCallback(
    (newId: string, revertAt: Date) => {
      if (newId === liquorbotId) return;
      setPrevLiquorbotId(p => p ?? liquorbotId);
      setIdState(newId);
      reconnect();

      const ms = revertAt.getTime() - Date.now();
      if (ms > 0) setTimeout(restorePreviousId, ms);
    },
    [liquorbotId, restorePreviousId, reconnect]
  );

  const isOverridden = useMemo(() => prevLiquorbotId !== null, [prevLiquorbotId]);

  const value = useMemo<LiquorBotContextValue>(
    () => ({
      isConnected,
      slots,
      liquorbotId,
      forceDisconnect,
      updateSlots,
      setLiquorbotId,
      reconnect,
      groups,
      isAdmin,
      temporaryOverrideId,
      restorePreviousId,
      isOverridden,
    }),
    [
      isConnected,
      slots,
      liquorbotId,
      forceDisconnect,
      updateSlots,
      setLiquorbotId,
      reconnect,
      groups,
      isAdmin,
      temporaryOverrideId,
      restorePreviousId,
      isOverridden,
    ]
  );

  return (
    <LiquorBotContext.Provider value={value}>
      {children}
    </LiquorBotContext.Provider>
  );
}

export function useLiquorBot() {
  return useContext(LiquorBotContext);
}