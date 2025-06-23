import React, { createContext, useState, useCallback, ReactNode } from 'react';

export type AuthScreen = 'signIn' | 'signUp' | 'forgotPassword' | 'confirmCode' | 'sessionLoading';

interface AuthModalContextType {
  visible: boolean;
  screen: AuthScreen;
  params: any;
  open: (screen: AuthScreen, params?: any) => void;
  close: () => void;
}

export const AuthModalContext = createContext<AuthModalContextType | undefined>(undefined);

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [screen, setScreen] = useState<AuthScreen>('signIn');
  const [params, setParams] = useState<any>({});

  const open = useCallback((screen: AuthScreen, params?: any) => {
    setScreen(screen);
    setParams(params || {});
    setVisible(true);
  }, []);

  const close = useCallback(() => setVisible(false), []);

  return (
    <AuthModalContext.Provider value={{ visible, screen, params, open, close }}>
      {children}
    </AuthModalContext.Provider>
  );
}
