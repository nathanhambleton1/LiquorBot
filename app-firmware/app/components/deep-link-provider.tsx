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
  useCallback,
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

type Ctx = { 
  pendingCode: string | null;
  clearPendingCode: () => void;
};
export const DeepLinkContext = createContext<Ctx>({
  pendingCode: null,
  clearPendingCode: () => {},
});

export function DeepLinkProvider({ children }: PropsWithChildren<object>) {
  const router = useRouter();
  const [pendingCode, setPendingCode] = useState<string | null>(null);

  useEffect(() => {
    const handleUrl = async (url: string | null) => {
      if (!url) return;
      
      const { path } = Linking.parse(url);
      if (path?.startsWith('join/')) {
        const code = path.split('/')[1];
        if (code) {
          // Clear any previous pending code
          await AsyncStorage.removeItem('pendingEventCode');
          
          // Store and set new code
          await AsyncStorage.setItem('pendingEventCode', code);
          setPendingCode(code);
          
          // Always route to home
          router.replace('/(tabs)');
        }
      }
    };

    // Handle cold/warm starts
    const processInitialUrl = async () => {
      const url = await Linking.getInitialURL();
      await handleUrl(url);
    };

    processInitialUrl();
    
    // Listen for URL events
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    
    return () => sub.remove();
  }, []);

  // Clear code after processing
  const clearPendingCode = useCallback(() => {
    setPendingCode(null);
    AsyncStorage.removeItem('pendingEventCode');
  }, []);

  return (
    <DeepLinkContext.Provider value={{ pendingCode, clearPendingCode }}>
      {children}
    </DeepLinkContext.Provider>
  );
}