import { startTraderBot } from "./trader-bot";

// ── Zubu the trader: the best trader in the world (he says so) ──────
// The user staked him $1,000. He trades more aggressively than Bobo:
// faster ticks, takes profit sooner, and spreads across more coins.

export const ZUBU_TRADER_NAME = "zubu";

export function startZubuTrader(): void {
  startTraderBot({
    name: ZUBU_TRADER_NAME,
    lockKey: 745_002_337,
    bankrollUsd: 1_000,
    minBuy: 10,
    maxBuy: 90,
    takeProfitPct: 5,   // locks in wins faster — world's best trader instincts
    maxPositions: 8,    // diversifies wider
    tickMs: 20_000,
  });
}
