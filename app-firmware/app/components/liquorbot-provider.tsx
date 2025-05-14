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

// Initialize PubSub with the AWS IoT endpoint
const pubsub = new PubSub({
  region: 'us-east-1',
  endpoint: 'wss://a2d1p97nzglf1y-ats.iot.us-east-1.amazonaws.com/mqtt',
});

const HEARTBEAT_TOPIC = 'liquorbot/liquorbot001/heartbeat';
const SLOT_CONFIG_TOPIC = 'liquorbot/liquorbot001/slot-config';

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

  // Add this useEffect to fetch config when connected
  useEffect(() => {
    if (isConnected) {
      const fetchConfig = async () => {
        try {
          await pubsub.publish({
            topics: [SLOT_CONFIG_TOPIC],
            message: { action: 'GET_CONFIG' }
          });
        } catch (error) {
          console.error('Error fetching config:', error);
        }
      };
      fetchConfig();
    }
  }, [isConnected]);

  // Utility so other screens can mark us disconnected
  function forceDisconnect() {
    setIsConnected(false);
  }

  useEffect(() => {
    // Subscribe to liquorbot/heartbeat
    const subscription = pubsub.subscribe({ topics: HEARTBEAT_TOPIC }).subscribe({
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
