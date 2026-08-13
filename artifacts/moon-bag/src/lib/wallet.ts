import { useState, useEffect, useCallback } from "react";

const BALANCE_KEY = "moonbag_balance";
const TRADER_KEY = "moonbag_trader";
const STARTING_BALANCE = 10_000;

const TRADER_NAMES = [
  "ape_king", "moon_maxi", "degen_dan", "diamond_paws", "to_the_moon",
  "hodl_gang", "pump_lord", "chad_trader", "bullrun_bro", "crypto_ape",
  "bag_hunter", "moon_chaser", "whale_alert", "green_candle", "rekt_proof",
];

function randomTraderName(): string {
  return TRADER_NAMES[Math.floor(Math.random() * TRADER_NAMES.length)] + "_" + Math.floor(Math.random() * 9999);
}

export function getBalance(): number {
  const stored = localStorage.getItem(BALANCE_KEY);
  if (stored === null) {
    const initial = STARTING_BALANCE;
    localStorage.setItem(BALANCE_KEY, String(initial));
    return initial;
  }
  return parseFloat(stored) || 0;
}

export function getTraderName(): string {
  const stored = localStorage.getItem(TRADER_KEY);
  if (!stored) {
    const name = randomTraderName();
    localStorage.setItem(TRADER_KEY, name);
    return name;
  }
  return stored;
}

export function setTraderName(name: string): void {
  localStorage.setItem(TRADER_KEY, name);
  window.dispatchEvent(new Event("moonbag_wallet_update"));
}

export function deductBalance(amount: number): boolean {
  const bal = getBalance();
  if (bal < amount) return false;
  localStorage.setItem(BALANCE_KEY, String(Math.max(0, bal - amount)));
  window.dispatchEvent(new Event("moonbag_wallet_update"));
  return true;
}

export function addBalance(amount: number): void {
  const bal = getBalance();
  localStorage.setItem(BALANCE_KEY, String(bal + amount));
  window.dispatchEvent(new Event("moonbag_wallet_update"));
}

export function depositFunds(amount: number): void {
  addBalance(amount);
}

export function useWallet() {
  const [balance, setBalance] = useState(() => getBalance());
  const [traderName, setTraderNameState] = useState(() => getTraderName());

  useEffect(() => {
    const handler = () => {
      setBalance(getBalance());
      setTraderNameState(getTraderName());
    };
    window.addEventListener("moonbag_wallet_update", handler);
    return () => window.removeEventListener("moonbag_wallet_update", handler);
  }, []);

  const updateTraderName = useCallback((name: string) => {
    setTraderName(name);
    setTraderNameState(name);
  }, []);

  const deposit = useCallback((amount: number) => {
    depositFunds(amount);
    setBalance(getBalance());
  }, []);

  const deduct = useCallback((amount: number): boolean => {
    const ok = deductBalance(amount);
    if (ok) setBalance(getBalance());
    return ok;
  }, []);

  const add = useCallback((amount: number) => {
    addBalance(amount);
    setBalance(getBalance());
  }, []);

  return { balance, traderName, updateTraderName, deposit, deduct, add };
}
