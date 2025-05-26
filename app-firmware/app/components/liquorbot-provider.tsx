// -----------------------------------------------------------------------------
// File: liquorbot-provider.tsx        (REPLACEMENT – 25 May 2025)
// Purpose:  • Provide LiquorBot connection / slot state
//           • Expose Cognito group claims (USER / ADMIN …) app-wide
//           • Memoised context => no needless re-renders on every heartbeat
// -----------------------------------------------------------------------------
import React, {
  createContext, useState, useEffect, useContext, ReactNode,
  useRef, useCallback, useMemo,
} from 'react';
import { Amplify } from 'aws-amplify';
import { Hub } from '@aws-amplify/core';
import { fetchAuthSession }   from '@aws-amplify/auth';
import { PubSub }             from '@aws-amplify/pubsub';
import config                 from '../../src/amplifyconfiguration.json';

Amplify.configure(config);

const pubsub = new PubSub({
  region   : 'us-east-1',
  endpoint : 'wss://a2d1p97nzglf1y-ats.iot.us-east-1.amazonaws.com/mqtt',
});

/*────────────────── Types / Defaults ──────────────────*/
interface LiquorBotContextValue {
  /* existing */
  isConnected    : boolean;
  slots          : number[];
  liquorbotId    : string;
  forceDisconnect: () => void;
  updateSlots    : (newSlots:number[]) => void;
  setLiquorbotId : (id:string) => void;
  reconnect      : () => void;
  /* NEW */
  groups         : string[];
  isAdmin        : boolean;
}
const LiquorBotContext = createContext<LiquorBotContextValue>({
  isConnected    : false,
  slots          : Array(15).fill(0),
  liquorbotId    : '000',
  forceDisconnect: () => {},
  updateSlots    : () => {},
  setLiquorbotId : () => {},
  reconnect      : () => {},
  groups         : [],
  isAdmin        : false,
});

/*────────────────── Provider ──────────────────*/
export function LiquorBotProvider({ children }:{ children:ReactNode }) {
  /* ---------- liquor-bot connectivity state ---------- */
  const [isConnected, setIsConnected] = useState(false);
  const [slots,        setSlots       ] = useState<number[]>(Array(15).fill(0));
  const [liquorbotId,  setLiquorbotId ] = useState('000');

  /* ---------- cognito group state ---------- */
  const [groups, setGroups] = useState<string[]>([]);
  const isAdmin = groups.includes('ADMIN');

  /* — fetch group claims once on mount & whenever tokens refresh — */
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const ses = await fetchAuthSession({ forceRefresh: true });
        const gs  = ses.tokens?.idToken?.payload['cognito:groups'] ?? [];
        setGroups(Array.isArray(gs) ? gs.filter((g): g is string => typeof g === 'string') : []);
      } catch { setGroups([]); }
    };
    fetchGroups();

    /* listen for sign-in / token refresh / sign-out */
    const listener = ({ payload }:any) => {
      if (['signIn','tokenRefresh'].includes(payload.event)) fetchGroups();
      if (payload.event === 'signOut') setGroups([]);
    };
    const hubListener = Hub.listen('auth', listener);
    return () => hubListener();
  }, []);

  /* ---------- reconnect tick ---------- */
  const lastHeartbeatRef  = useRef<number>(0);
  const [reconnTick, bumpReconnect] = useState(0);
  const reconnect = useCallback(() => bumpReconnect(t => t + 1), []);
  const forceDisconnect = useCallback(() => setIsConnected(false), []);

  /* ---------- updateSlots helper ---------- */
  const updateSlots = useCallback((newSlots:number[]) => {
    setSlots(newSlots);
    const topic = `liquorbot/liquorbot${liquorbotId}/slot-config`;
    pubsub.publish({ topics:[topic], message:{ action:'CURRENT_CONFIG', slots:newSlots } })
          .catch(console.error);
  }, [liquorbotId]);

  /* ---------- slot-config subscription ---------- */
  useEffect(() => {
    const topic = `liquorbot/liquorbot${liquorbotId}/slot-config`;
    let sub:any, retry:NodeJS.Timeout;
    const handleSlotConfig = (msg:any) => {
      if (msg.action==='CURRENT_CONFIG' && Array.isArray(msg.slots)) {
        setSlots(msg.slots.map((id:any)=>Number(id)||0));
      }
      if (msg.action==='SET_SLOT' && typeof msg.slot==='number') {
        setSlots(prev => {
          const next=[...prev];
          next[msg.slot-1] = Number(msg.ingredientId)||0;
          return next;
        });
      }
    };
    const start = () => {
      sub = pubsub.subscribe({ topics:[topic] }).subscribe({
        next : d => handleSlotConfig((d as any).value ?? d),
        error: e => { console.error('config sub error',e); retry=setTimeout(start,5000); },
      });
    };
    start();
    return () => { sub?.unsubscribe(); if (retry) clearTimeout(retry); };
  }, [liquorbotId, reconnTick]);

  /* ---------- fetch current config on connect ---------- */
  useEffect(() => {
    if (!isConnected) return;
    pubsub.publish({
      topics : [`liquorbot/liquorbot${liquorbotId}/slot-config`],
      message: { action:'GET_CONFIG' },
    }).catch(console.error);
  }, [isConnected, liquorbotId]);

  /* ---------- heartbeat subscription ---------- */
  useEffect(() => {
    const topic = `liquorbot/liquorbot${liquorbotId}/heartbeat`;
    let sub:any, retry:NodeJS.Timeout;
    const start = () => {
      sub = pubsub.subscribe({ topics:[topic] }).subscribe({
        next : () => { lastHeartbeatRef.current = Date.now(); },
        error: e => { console.error('heartbeat sub error',e); retry=setTimeout(start,5000); },
      });
    };
    start();
    return () => { sub?.unsubscribe(); if (retry) clearTimeout(retry); };
  }, [liquorbotId, reconnTick]);

  /* ---------- connection watchdog ---------- */
  useEffect(() => {
    const id = setInterval(() => {
      const alive = Date.now() - lastHeartbeatRef.current < 7000;
      setIsConnected(prev => (prev === alive ? prev : alive));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  /* ---------- memoised context ---------- */
  const contextValue = useMemo<LiquorBotContextValue>(() => ({
    isConnected, slots, liquorbotId, forceDisconnect,
    updateSlots, setLiquorbotId, reconnect,
    groups, isAdmin,            // ← NEW
  }), [isConnected, slots, liquorbotId, forceDisconnect,
       updateSlots, reconnect, groups, isAdmin]);

  return (
    <LiquorBotContext.Provider value={contextValue}>
      {children}
    </LiquorBotContext.Provider>
  );
}

/*────────────────── Hook ──────────────────*/
export function useLiquorBot() {
  return useContext(LiquorBotContext);
}
