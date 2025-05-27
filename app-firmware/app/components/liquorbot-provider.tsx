// -----------------------------------------------------------------------------
// File: liquorbot-provider.tsx        (REPLACEMENT – 27 May 2025)
// Purpose:  • Persist last-connected LiquorBot ID across app restarts
//           • Everything else unchanged
// -----------------------------------------------------------------------------
import React, {
  createContext, useState, useEffect, useContext, ReactNode,
  useRef, useCallback, useMemo,
} from 'react';
import { Amplify } from 'aws-amplify';
import { Hub }     from '@aws-amplify/core';
import { fetchAuthSession } from '@aws-amplify/auth';
import { PubSub }          from '@aws-amplify/pubsub';
import AsyncStorage        from '@react-native-async-storage/async-storage';
import config              from '../../src/amplifyconfiguration.json';

Amplify.configure(config);

const pubsub = new PubSub({
  region  : 'us-east-1',
  endpoint: 'wss://a2d1p97nzglf1y-ats.iot.us-east-1.amazonaws.com/mqtt',
});

/*────────────────── Types / Defaults ──────────────────*/
interface LiquorBotContextValue {
  isConnected : boolean;
  slots       : number[];
  liquorbotId : string;
  forceDisconnect: () => void;
  updateSlots : (s:number[]) => void;
  setLiquorbotId: (id:string)=>void;
  reconnect   : () => void;
  groups      : string[];
  isAdmin     : boolean;
}
const LiquorBotContext = createContext<LiquorBotContextValue>({
  isConnected:false, slots:Array(15).fill(0), liquorbotId:'000',
  forceDisconnect:()=>{}, updateSlots:()=>{}, setLiquorbotId:()=>{},
  reconnect:()=>{}, groups:[], isAdmin:false,
});

/*────────────────── Provider ──────────────────*/
export function LiquorBotProvider({ children }:{ children:ReactNode }) {
  /* ---------- liquor-bot state ---------- */
  const [isConnected, setIsConnected] = useState(false);
  const [slots, setSlots]             = useState<number[]>(Array(15).fill(0));
  const [liquorbotId, setIdState]     = useState('000');

  /* ---------- persist / re-hydrate ID ---------- */
  useEffect(() => {
    AsyncStorage.getItem('liquorbotId')
      .then(stored => { if (stored) setIdState(stored); })
      .catch(console.warn);
  }, []);
  const setLiquorbotId = useCallback(async(id:string) => {
    setIdState(id);
    try { await AsyncStorage.setItem('liquorbotId', id); } catch {}
    reconnect();                              // resubscribe with new ID
  }, []);

  /* ---------- Cognito groups ---------- */
  const [groups, setGroups] = useState<string[]>([]);
  const isAdmin             = groups.includes('ADMIN');
  useEffect(() => {
    const load = async () => {
      try {
        const ses = await fetchAuthSession({ forceRefresh:true });
        const gs  = ses.tokens?.idToken?.payload['cognito:groups'] ?? [];
        setGroups(Array.isArray(gs) ? gs.filter((g):g is string=>typeof g==='string') : []);
      } catch { setGroups([]); }
    };
    load();
    const sub = Hub.listen('auth', ({payload})=>{
      if(['signIn','tokenRefresh'].includes(payload.event)) load();
      if(payload.event==='signedOut') setGroups([]);
    });
    return ()=>sub();
  }, []);

  /* ---------- reconnect tick ---------- */
  const lastHeartbeatRef       = useRef<number>(0);
  const [reconnTick, setTick ] = useState(0);
  const reconnect  = useCallback(()=>setTick(t=>t+1),[]);
  const forceDisconnect = useCallback(()=>setIsConnected(false),[]);

  /* ---------- updateSlots helper ---------- */
  const updateSlots = useCallback((newSlots:number[])=>{
    setSlots(newSlots);
    const topic = `liquorbot/liquorbot${liquorbotId}/slot-config`;
    pubsub.publish({ topics:[topic], message:{action:'CURRENT_CONFIG',slots:newSlots}})
          .catch(console.error);
  },[liquorbotId]);

  /* ---------- slot-config subscription ---------- */
  useEffect(()=>{
    const topic=`liquorbot/liquorbot${liquorbotId}/slot-config`;
    let sub:any, retry:NodeJS.Timeout;
    const start=()=>{
      sub = pubsub.subscribe({topics:[topic]}).subscribe({
        next:d=>{
          const msg=(d as any).value??d;
          if(msg.action==='CURRENT_CONFIG'&&Array.isArray(msg.slots))
            setSlots(msg.slots.map((n:any)=>Number(n)||0));
          if(msg.action==='SET_SLOT'&&typeof msg.slot==='number')
            setSlots(p=>{const n=[...p]; n[msg.slot-1]=Number(msg.ingredientId)||0; return n;});
        },
        error:e=>{console.error('config sub',e); retry=setTimeout(start,5000);}
      });
    }; start();
    return ()=>{sub?.unsubscribe(); if(retry)clearTimeout(retry);};
  },[liquorbotId,reconnTick]);

  /* ---------- request config on connect ---------- */
  useEffect(()=>{
    if(!isConnected) return;
    pubsub.publish({
      topics:[`liquorbot/liquorbot${liquorbotId}/slot-config`],
      message:{action:'GET_CONFIG'}
    }).catch(console.error);
  },[isConnected,liquorbotId]);

  /* ---------- heartbeat subscription ---------- */
  useEffect(()=>{
    const topic=`liquorbot/liquorbot${liquorbotId}/heartbeat`;
    let sub:any, retry:NodeJS.Timeout;
    const start=()=>{
      sub=pubsub.subscribe({topics:[topic]}).subscribe({
        next:()=>{lastHeartbeatRef.current=Date.now();},
        error:e=>{console.error('hb sub',e); retry=setTimeout(start,5000);}
      });
    }; start();
    return ()=>{sub?.unsubscribe(); if(retry)clearTimeout(retry);};
  },[liquorbotId,reconnTick]);

  /* ---------- watchdog ---------- */
  useEffect(()=>{
    const id=setInterval(()=>{
      const alive = Date.now()-lastHeartbeatRef.current < 7000;
      setIsConnected(prev=>prev===alive?prev:alive);
    },1000);
    return ()=>clearInterval(id);
  },[]);

  /* ---------- memo ---------- */
  const value = useMemo<LiquorBotContextValue>(()=>({
    isConnected, slots, liquorbotId, forceDisconnect,
    updateSlots, setLiquorbotId, reconnect,
    groups, isAdmin,
  }),[isConnected,slots,liquorbotId,forceDisconnect,
      updateSlots,reconnect,groups,isAdmin]);

  return (
    <LiquorBotContext.Provider value={value}>
      {children}
    </LiquorBotContext.Provider>
  );
}

/*────────────────── Hook ──────────────────*/
export function useLiquorBot() { return useContext(LiquorBotContext); }
