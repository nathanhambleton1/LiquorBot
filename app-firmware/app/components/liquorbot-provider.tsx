// File: liquorbot-provider.tsx
import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  ReactNode,
  useRef,
} from 'react';
import { PubSub } from '@aws-amplify/pubsub';
import { Amplify } from 'aws-amplify';
import config from '../../src/amplifyconfiguration.json';

Amplify.configure(config);

const pubsub = new PubSub({
  region: 'us-east-1',
  endpoint: 'wss://a2d1p97nzglf1y-ats.iot.us-east-1.amazonaws.com/mqtt',
});

interface LiquorBotContextValue {
  isConnected: boolean;
  slots: number[];
  liquorbotId: string;
  forceDisconnect: () => void;
  updateSlots: (newSlots: number[]) => void;
  setLiquorbotId: (id: string) => void;
}

const LiquorBotContext = createContext<LiquorBotContextValue>({
  isConnected: false,
  slots: Array(15).fill(0),
  liquorbotId: '000',
  forceDisconnect: () => {},
  updateSlots: () => {},
  setLiquorbotId: () => {},
});

export function LiquorBotProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastHeartbeat, setLastHeartbeat] = useState<number>(0);
  const [slots, setSlots] = useState<number[]>(Array(15).fill(0));
  const [liquorbotId, setLiquorbotId] = useState('000');
  const lastHeartbeatRef = useRef(lastHeartbeat);

  // Sync ref with state
  useEffect(() => {
    lastHeartbeatRef.current = lastHeartbeat;
  }, [lastHeartbeat]);

  const handleSlotConfig = (message: any) => {
    if (message.action === 'CURRENT_CONFIG' && Array.isArray(message.slots)) {
      setSlots(message.slots.map((id: any) => Number(id) || 0));
    }
    if (message.action === 'SET_SLOT' && typeof message.slot === 'number') {
      setSlots(prev => {
        const next = [...prev];
        next[message.slot - 1] = Number(message.ingredientId) || 0;
        return next;
      });
    }
  };

  // Subscribe to config updates with retry logic
  useEffect(() => {
    const slotConfigTopic = `liquorbot/liquorbot${liquorbotId}/slot-config`;
    let subscription: any;
    let retryTimeout: NodeJS.Timeout;

    const subscribe = () => {
      subscription = pubsub.subscribe({ topics: [slotConfigTopic] }).subscribe({
        next: (data) => handleSlotConfig((data as any)?.value ?? data),
        error: (error) => {
          console.error('Config subscription error:', error);
          retryTimeout = setTimeout(subscribe, 5000);
        },
      });
    };

    subscribe();

    return () => {
      if (subscription) subscription.unsubscribe();
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [liquorbotId]);

  // Fetch config when connected
  useEffect(() => {
    if (isConnected) {
      const slotConfigTopic = `liquorbot/liquorbot${liquorbotId}/slot-config`;
      pubsub.publish({
        topics: [slotConfigTopic],
        message: { action: 'GET_CONFIG' }
      }).catch(error => console.error('Config fetch error:', error));
    }
  }, [isConnected, liquorbotId]);

  // Heartbeat subscription with retry logic
  useEffect(() => {
    const heartbeatTopic = `liquorbot/liquorbot${liquorbotId}/heartbeat`;
    let subscription: any;
    let retryTimeout: NodeJS.Timeout;

    const subscribe = () => {
      subscription = pubsub.subscribe({ topics: [heartbeatTopic] }).subscribe({
        next: (data) => {
          const now = Date.now();
          setLastHeartbeat(now);
          lastHeartbeatRef.current = now;
        },
        error: (error) => {
          console.error('Heartbeat subscription error:', error);
          retryTimeout = setTimeout(subscribe, 5000);
        },
      });
    };

    subscribe();

    return () => {
      if (subscription) subscription.unsubscribe();
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [liquorbotId]);

  // Connection status check interval
  useEffect(() => {
    const intervalId = setInterval(() => {
      const timeSince = Date.now() - lastHeartbeatRef.current;
      setIsConnected(timeSince < 7000);
    }, 1000);

    return () => clearInterval(intervalId);
  }, []);

  const contextValue: LiquorBotContextValue = {
    isConnected,
    slots,
    liquorbotId,
    setLiquorbotId: (id: string) => {
      setLiquorbotId(id);
    },
    forceDisconnect: () => setIsConnected(false),
    updateSlots: (newSlots) => {
      setSlots(newSlots);
      const slotConfigTopic = `liquorbot/liquorbot${liquorbotId}/slot-config`;
      pubsub.publish({
        topics: [slotConfigTopic],
        message: { 
          action: 'CURRENT_CONFIG',
          slots: newSlots
        }
      }).catch(console.error);
    }
  };

  return (
    <LiquorBotContext.Provider value={contextValue}>
      {children}
    </LiquorBotContext.Provider>
  );
}

export function useLiquorBot() {
  return useContext(LiquorBotContext);
}