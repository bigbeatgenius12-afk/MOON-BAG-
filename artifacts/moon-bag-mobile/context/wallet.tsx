import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Simulated cash wallet — same model as the web app: every player starts
// with $10,000 of play money, persisted locally on the device.

const STORAGE_KEY = 'moonbag_wallet_v1';
const STARTING_BALANCE = 10_000;
export const TRADER_NAME = 'you';

interface WalletState {
  balance: number;
  ready: boolean;
  deduct: (usd: number) => boolean;
  add: (usd: number) => void;
  reset: () => void;
}

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [balance, setBalance] = useState<number>(STARTING_BALANCE);
  const [ready, setReady] = useState<boolean>(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw !== null) {
          const parsed = Number(raw);
          if (!Number.isNaN(parsed)) setBalance(parsed);
        }
      })
      .finally(() => setReady(true));
  }, []);

  const persist = useCallback((next: number) => {
    setBalance(next);
    AsyncStorage.setItem(STORAGE_KEY, String(next)).catch(() => {});
  }, []);

  const deduct = useCallback((usd: number): boolean => {
    let ok = false;
    setBalance((prev) => {
      if (prev >= usd) {
        ok = true;
        const next = prev - usd;
        AsyncStorage.setItem(STORAGE_KEY, String(next)).catch(() => {});
        return next;
      }
      return prev;
    });
    return ok;
  }, []);

  const add = useCallback((usd: number) => {
    setBalance((prev) => {
      const next = prev + usd;
      AsyncStorage.setItem(STORAGE_KEY, String(next)).catch(() => {});
      return next;
    });
  }, []);

  const reset = useCallback(() => persist(STARTING_BALANCE), [persist]);

  return (
    <WalletContext.Provider value={{ balance, ready, deduct, add, reset }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}
