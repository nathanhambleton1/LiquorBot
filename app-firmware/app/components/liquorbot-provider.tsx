// -----------------------------------------------------------------------------
// File: liquorbot-provider.tsx        (REPLACEMENT – 24 May 2025)
// Purpose:  • Provide LiquorBot connection / slot state
//           • Memoised context => no needless re-renders on every heartbeat
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
import { Amplify }  from 'aws-amplify';
import { PubSub }   from '@aws-amplify/pubsub';
import config       from '../../src/amplifyconfiguration.json';

Amplify.configure(config);

const pubsub = new PubSub({
  region   : 'us-east-1',
  endpoint : 'wss://a2d1p97nzglf1y-ats.iot.us-east-1.amazonaws.com/mqtt',
});

/*────────────────── Types / Defaults ──────────────────*/
interface LiquorBotContextValue {
  isConnected    : boolean;
  slots          : number[];
  liquorbotId    : string;
  forceDisconnect: () => void;
  updateSlots    : (newSlots:number[]) => void;
  setLiquorbotId : (id:string) => void;
  reconnect      : () => void;
}
const LiquorBotContext = createContext<LiquorBotContextValue>({
  isConnected    : false,
  slots          : Array(15).fill(0),
  liquorbotId    : '000',
  forceDisconnect: () => {},
  updateSlots    : () => {},
  setLiquorbotId : () => {},
  reconnect      : () => {},
});

/*────────────────── Provider ──────────────────*/
export function LiquorBotProvider({ children }:{ children:ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [slots,        setSlots       ] = useState<number[]>(Array(15).fill(0));
  const [liquorbotId,  setLiquorbotId ] = useState('000');

  const lastHeartbeatRef  = useRef<number>(0);
  const [reconnTick, bumpReconnect] = useState(0);   // forces resubscribe

  /*────────── Helpers (stable with useCallback) ──────────*/
  const reconnect = useCallback(() => bumpReconnect(t => t + 1), []);
  const forceDisconnect = useCallback(() => setIsConnected(false), []);
  const updateSlots = useCallback((newSlots:number[]) => {
    setSlots(newSlots);
    const topic = `liquorbot/liquorbot${liquorbotId}/slot-config`;
    pubsub.publish({ topics:[topic], message:{ action:'CURRENT_CONFIG', slots:newSlots } })
          .catch(console.error);
  }, [liquorbotId]);

  /*────────── Slot-config subscription ──────────*/
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
  useEffect(() => {
    const topic = `liquorbot/liquorbot${liquorbotId}/slot-config`;
    let sub:any, retry:NodeJS.Timeout;

    const start = () => {
      sub = pubsub.subscribe({ topics:[topic] }).subscribe({
        next : d => handleSlotConfig((d as any).value ?? d),
        error: e => { console.error('config sub error',e); retry=setTimeout(start,5000); },
      });
    };
    start();
    return () => { sub?.unsubscribe(); if (retry) clearTimeout(retry); };
  }, [liquorbotId, reconnTick]);

  /*────────── Fetch current config when connected ──────────*/
  useEffect(() => {
    if (!isConnected) return;
    pubsub.publish({
      topics : [`liquorbot/liquorbot${liquorbotId}/slot-config`],
      message: { action:'GET_CONFIG' },
    }).catch(console.error);
  }, [isConnected, liquorbotId]);

  /*────────── Heartbeat subscription ──────────*/
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

  /*────────── Connection watchdog ──────────*/
  useEffect(() => {
    const id = setInterval(() => {
      const alive = Date.now() - lastHeartbeatRef.current < 7000;
      // setState only when value *changes* to avoid needless re-renders
      setIsConnected(prev => (prev === alive ? prev : alive));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  /*────────── Stable context value (memoised) ──────────*/
  const contextValue = useMemo<LiquorBotContextValue>(() => ({
    isConnected,
    slots,
    liquorbotId,
    forceDisconnect,
    updateSlots,
    setLiquorbotId,
    reconnect,
  }), [isConnected, slots, liquorbotId, forceDisconnect, updateSlots, reconnect]);

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
