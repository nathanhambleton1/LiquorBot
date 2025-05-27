// -----------------------------------------------------------------------------
// File: liquorbot-provider.tsx
// Purpose:  • Persist LiquorBot ID
//           • Load Cognito groups from cache *or* one-shot session fetch
//           • Still zero infinite refresh loops — no UI flicker
// -----------------------------------------------------------------------------
import React, {
  createContext, useState, useEffect, useContext, ReactNode,
  useRef, useCallback, useMemo,
} from 'react';
import { Amplify } from 'aws-amplify';
import { Hub } from 'aws-amplify/utils';
import { PubSub }       from '@aws-amplify/pubsub';
import { fetchAuthSession } from '@aws-amplify/auth';
import AsyncStorage     from '@react-native-async-storage/async-storage';
import config           from '../../src/amplifyconfiguration.json';

Amplify.configure(config);

const pubsub = new PubSub({
  region  : 'us-east-1',
  endpoint: 'wss://a2d1p97nzglf1y-ats.iot.us-east-1.amazonaws.com/mqtt',
});

interface LiquorBotContextValue {
  isConnected   : boolean;
  slots         : number[];
  liquorbotId   : string;
  forceDisconnect: () => void;
  updateSlots   : (s:number[]) => void;
  setLiquorbotId: (id:string)=>void;
  reconnect     : () => void;
  groups        : string[];
  isAdmin       : boolean;
}
const LiquorBotContext = createContext<LiquorBotContextValue>({} as any);

/*────────────────── helper ──────────────────*/
async function grabGroupsOnce(cacheKey='userGroups'):Promise<string[]> {
  /* 1️⃣ try cache first */
  const cached = await AsyncStorage.getItem(cacheKey);
  if (cached) return JSON.parse(cached);

  /* 2️⃣ otherwise pull from the current ID-token */
  const ses = await fetchAuthSession();
  const raw = ses.tokens?.idToken?.payload['cognito:groups'] ?? [];
  const groups = Array.isArray(raw) ? raw.filter((g):g is string => typeof g === 'string') : [];
  await AsyncStorage.setItem(cacheKey, JSON.stringify(groups));
  return groups;
}

/*────────────────── Provider ──────────────────*/
export function LiquorBotProvider({ children }:{ children:ReactNode }) {
  /* ---------- liquor-bot basics ---------- */
  const [isConnected, setIsConnected] = useState(false);
  const [slots,        setSlots]      = useState<number[]>(Array(15).fill(0));
  const [liquorbotId,  setIdState]    = useState('000');

  /* ---------- saved ID ---------- */
  useEffect(() => {
    AsyncStorage.getItem('liquorbotId')
      .then(v => { if (v) setIdState(v); })
      .catch(console.warn);
  }, []);
  const setLiquorbotId = useCallback(async(id:string)=>{
    setIdState(id);
    try{ await AsyncStorage.setItem('liquorbotId', id);}catch{}
    reconnect();
  },[]);

  /* ---------- Cognito groups ---------- */
  const [groups, setGroups] = useState<string[]>([]);
  const syncGroups = useCallback(
    () => grabGroupsOnce().then(setGroups).catch(()=>setGroups([])),
    []
  );

  /* load once on mount */
  useEffect(() => { syncGroups(); }, [syncGroups]);

  /* update on auth Hub events */
  useEffect(() => {
    const sub = Hub.listen('auth', ({payload})=>{
      if(payload.event === 'signedIn')         syncGroups();
      if(payload.event === 'signedOut') { setGroups([]); AsyncStorage.removeItem('userGroups').catch(()=>{}); }
    });
    return () => sub();
  }, [syncGroups]);

  const isAdmin = groups.includes('ADMIN');    // change string if your group is named differently

  /* ---------- reconnect tick etc. (unchanged) ---------- */
  const lastHeartbeatRef = useRef(0);
  const [reTick, setTick] = useState(0);
  const reconnect        = useCallback(()=>setTick(t=>t+1),[]);
  const forceDisconnect  = useCallback(()=>setIsConnected(false),[]);

  const updateSlots = useCallback((newSlots:number[])=>{
    setSlots(newSlots);
    const topic = `liquorbot/liquorbot${liquorbotId}/slot-config`;
    pubsub.publish({ topics:[topic], message:{action:'CURRENT_CONFIG', slots:newSlots}}).catch(console.error);
  },[liquorbotId]);

  /* slot-config sub, heartbeat sub, watchdog — same as before … */
  useEffect(()=>{
    const topic = `liquorbot/liquorbot${liquorbotId}/slot-config`;
    let sub:any, retry:NodeJS.Timeout;
    const start=()=>{
      sub = pubsub.subscribe({ topics:[topic]}).subscribe({
        next:d=>{
          const msg=(d as any).value ?? d;
          if(msg.action==='CURRENT_CONFIG' && Array.isArray(msg.slots))
            setSlots(msg.slots.map((n:any)=>Number(n)||0));
          if(msg.action==='SET_SLOT' && typeof msg.slot==='number')
            setSlots(p=>{const n=[...p]; n[msg.slot-1]=Number(msg.ingredientId)||0; return n;});
        },
        error:e=>{console.error('config sub',e); retry=setTimeout(start,5000);}
      });
    }; start();
    return ()=>{sub?.unsubscribe(); if(retry) clearTimeout(retry);};
  },[liquorbotId,reTick]);

  useEffect(()=>{
    const topic = `liquorbot/liquorbot${liquorbotId}/heartbeat`;
    let sub:any, retry:NodeJS.Timeout;
    const start=()=>{
      sub = pubsub.subscribe({ topics:[topic]}).subscribe({
        next:()=>{ lastHeartbeatRef.current = Date.now(); },
        error:e=>{ console.error('hb sub',e); retry=setTimeout(start,5000); }
      });
    }; start();
    return ()=>{sub?.unsubscribe(); if(retry) clearTimeout(retry);};
  },[liquorbotId,reTick]);

  useEffect(()=>{
    const id = setInterval(()=>{
      const alive = Date.now()-lastHeartbeatRef.current < 7000;
      setIsConnected(prev=>prev===alive?prev:alive);
    },1000);
    return ()=>clearInterval(id);
  },[]);

  /* ---------- context ---------- */
  const value = useMemo<LiquorBotContextValue>(()=>({
    isConnected, slots, liquorbotId,
    forceDisconnect, updateSlots, setLiquorbotId, reconnect,
    groups, isAdmin,
  }),[isConnected, slots, liquorbotId, forceDisconnect,
      updateSlots, setLiquorbotId, reconnect, groups, isAdmin]);

  return <LiquorBotContext.Provider value={value}>{children}</LiquorBotContext.Provider>;
}

export function useLiquorBot(){ return useContext(LiquorBotContext); }
