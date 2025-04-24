// -----------------------------------------------------------------------------
// File: liquorbot-provider.tsx
// Description: Provides a React context for managing LiquorBot's connection 
//              status and handling IoT PubSub subscriptions. Integrates with 
//              AWS Amplify for PubSub communication.
// Author: Nathan Hambleton
// Created:  March 1, 2025
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

interface LiquorBotContextValue {
  isConnected: boolean;
  forceDisconnect: () => void; // <-- added
}

const LiquorBotContext = createContext<LiquorBotContextValue>({
  isConnected: false,
  forceDisconnect: () => {},
});

export function LiquorBotProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastHeartbeat, setLastHeartbeat] = useState<number>(0);

  // Utility so other screens can mark us disconnected
  function forceDisconnect() {
    setIsConnected(false);
  }

  useEffect(() => {
    // Subscribe to liquorbot/heartbeat
    const subscription = pubsub.subscribe({ topics: 'liquorbot/liquorbot001/heartbeat' }).subscribe({
      next: (data) => {
        setLastHeartbeat(Date.now());
      },
      error: (error) => console.error('Subscription error:', error),
      complete: () => console.log('Subscription completed.'),
    });

    // Check connection status every 1 second
    const intervalId = setInterval(() => {
      if (Date.now() - lastHeartbeat < 7000) {
        setIsConnected(true);
      } else {
        setIsConnected(false);
      }
    }, 1000);

    return () => {
      subscription.unsubscribe();
      clearInterval(intervalId);
    };
  }, [lastHeartbeat]);

  return (
    <LiquorBotContext.Provider value={{ isConnected, forceDisconnect }}>
      {children}
    </LiquorBotContext.Provider>
  );
}

export function useLiquorBot() {
  return useContext(LiquorBotContext);
}
