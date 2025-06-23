import React, { createContext, useState, useCallback, ReactNode } from 'react';

export type AuthScreen = 'signIn' | 'signUp' | 'forgotPassword' | 'confirmCode';

interface AuthModalContextType {
  visible: boolean;
  screen: AuthScreen;
  open: (screen: AuthScreen) => void;
  close: () => void;
}

export const AuthModalContext = createContext<AuthModalContextType | undefined>(undefined);

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [screen, setScreen] = useState<AuthScreen>('signIn');

  const open = useCallback((screen: AuthScreen) => {
    setScreen(screen);
    setVisible(true);
  }, []);

  const close = useCallback(() => setVisible(false), []);

  return (
    <AuthModalContext.Provider value={{ visible, screen, open, close }}>
      {children}
    </AuthModalContext.Provider>
  );
}
