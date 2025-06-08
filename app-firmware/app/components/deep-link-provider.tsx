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
      const { path } = Linking.parse(url);
      if (path?.startsWith('join/')) {
        const code = path.split('/')[1]!;
        setPendingCode(code);
        AsyncStorage.setItem('pendingEventCode', code);
        
        // ► HERE: push into your catch-route
        router.replace({ pathname: '/join/[code]', params: { code: code } } as any);
      }
    };

    Linking.getInitialURL().then(u => u && handle({ url: u }));
    const sub = Linking.addEventListener('url', handle);
    return () => sub.remove();
  }, []);

  return (
    <DeepLinkContext.Provider value={{ pendingCode }}>
      {children}
    </DeepLinkContext.Provider>
  );
}
