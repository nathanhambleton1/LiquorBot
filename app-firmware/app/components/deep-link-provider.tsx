// -----------------------------------------------------------------------------
// File:   components/deep-link-provider.tsx
// Purpose: • Listen for Universal-/Custom-link hits (join/<code>)
//          • Store code in AsyncStorage
//          • If user unauthenticated → push to sign-in
//          • After user signs in     → call joinEventByCode()
//          • Expose pendingCode via context (optional UI use)
// -----------------------------------------------------------------------------
import React, {
  createContext,
  PropsWithChildren,
  useEffect,
  useState,
} from 'react';
import * as Linking          from 'expo-linking';
import AsyncStorage          from '@react-native-async-storage/async-storage';
import { useRouter }         from 'expo-router';
import { Hub }               from 'aws-amplify/utils';
import { fetchAuthSession }  from '@aws-amplify/auth';

// --- TODO: replace this with **your** real join-event mutation/helper ---
async function joinEventByCode(eventCode: string) {
  /* 
     e.g. await API.graphql({ query: joinEvent, variables: { eventCode }});
  */
  console.log('🔗 Deep-link auto-joining event', eventCode);
}

type Ctx = { pendingCode: string | null };
export const DeepLinkContext = createContext<Ctx>({ pendingCode: null });

export function DeepLinkProvider({ children }: PropsWithChildren<object>) {
  const router            = useRouter();
  const [pendingCode, setPendingCode] = useState<string | null>(null);

  /* ───── 1. Capture any /join/<code> URL ───── */
  useEffect(() => {
    const handle = ({ url }: { url: string }) => {
      const { scheme, path } = Linking.parse(url);
      // Accept both Universal Links and the new unique custom scheme
      if ((scheme === 'liquorbotapp' && path?.startsWith('join/')) || (scheme === undefined && path?.startsWith('join/'))) {
        const code = path.split('/')[1];
        if (code) {
          setPendingCode(code);
          AsyncStorage.setItem('pendingEventCode', code);
          // Always route to home page; let home page handle auth modal
          router.replace('/(tabs)');
        }
      }
    };

    // a) cold-start link
    Linking.getInitialURL().then(u => u && handle({ url: u }));
    // b) warm-app link
    const sub = Linking.addEventListener('url', handle);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    // ← NEW: bootstrap from storage after cold-start redirect
    AsyncStorage.getItem('pendingEventCode').then(saved => {
      if (saved) {
        setPendingCode(saved);
        AsyncStorage.removeItem('pendingEventCode');
      }
    });
  }, []);

  return (
    <DeepLinkContext.Provider value={{ pendingCode }}>
      {children}
    </DeepLinkContext.Provider>
  );
}
