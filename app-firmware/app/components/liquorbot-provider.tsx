// -----------------------------------------------------------------------------
// File: liquorbot-provider.tsx
// Description: Provides a React context for managing LiquorBot's connection 
//              status, configuration, and handling IoT PubSub subscriptions.
// -----------------------------------------------------------------------------
import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  ReactNode,
} from 'react';
import { PubSub } from '@aws-amplify/pubsub';
import { Amplify } from 'aws-amplify';
import config from '../../src/amplifyconfiguration.json';

Amplify.configure(config);

const pubsub = new PubSub({
  region: 'us-east-1',
  endpoint: 'wss://a2d1p97nzglf1y-ats.iot.us-east-1.amazonaws.com/mqtt',
});

const HEARTBEAT_TOPIC = 'liquorbot/liquorbot${liquorbotId}/heartbeat';
const SLOT_CONFIG_TOPIC = 'liquorbot/liquorbot${liquorbotId}/slot-config';

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

  // Centralized slot configuration handler
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

  // Subscribe to config updates
  useEffect(() => {
    const subscription = pubsub.subscribe({ topics: [SLOT_CONFIG_TOPIC] }).subscribe({
      next: (data) => handleSlotConfig((data as any)?.value ?? data),
      error: (error) => console.error('Config subscription error:', error),
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch config when connected
  useEffect(() => {
    if (isConnected) {
      pubsub.publish({
        topics: [SLOT_CONFIG_TOPIC],
        message: { action: 'GET_CONFIG' }
      }).catch(error => console.error('Config fetch error:', error));
    }
  }, [isConnected]);

  // Connection status management
  useEffect(() => {
    const subscription = pubsub.subscribe({ topics: HEARTBEAT_TOPIC }).subscribe({
      next: () => setLastHeartbeat(Date.now()),
      error: (error) => console.error('Heartbeat subscription error:', error),
    });

    const intervalId = setInterval(() => {
      setIsConnected(Date.now() - lastHeartbeat < 7000);
    }, 1000);

    return () => {
      subscription.unsubscribe();
      clearInterval(intervalId);
    };
  }, [lastHeartbeat]);

  const contextValue: LiquorBotContextValue = {
    isConnected,
    slots,
    liquorbotId,
    setLiquorbotId,
    forceDisconnect: () => setIsConnected(false),
    updateSlots: (newSlots) => {
      setSlots(newSlots);
      pubsub.publish({
        topics: [`liquorbot/liquorbot${liquorbotId}/slot-config`],
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