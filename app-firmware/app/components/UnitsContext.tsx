import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Key for storing user unit preference
const STORAGE_KEY = 'pref_units';
export type Units = 'oz' | 'ml';

interface UnitsContextValue {
  units: Units;
  setUnits: (u: Units) => void;
}

const UnitsContext = createContext<UnitsContextValue>({
  units: 'oz',
  setUnits: () => {},
});

export const UnitsProvider = ({ children }: { children: ReactNode }) => {
  const [units, setUnitsState] = useState<Units>('oz');

  // Load preference on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(value => {
        if (value === 'ml') setUnitsState('ml');
      })
      .catch(() => {});
  }, []);

  // Update storage when units change
  const setUnits = (u: Units) => {
    setUnitsState(u);
    AsyncStorage.setItem(STORAGE_KEY, u).catch(() => {});
  };

  return (
    <UnitsContext.Provider value={{ units, setUnits }}>
      {children}
    </UnitsContext.Provider>
  );
};

export const useUnits = () => useContext(UnitsContext);

// Conversion helpers
export const ozToMl = (oz: number) => oz * 29.5735;
export const mlToOz = (ml: number) => ml / 29.5735;
