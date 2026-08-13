import { startTraderBot } from "./trader-bot";

// ── Bobo: the super cool, smart bot trader ──────────────────────────
// Steady dip-buyer with a $1,500 bankroll. See trader-bot.ts for the engine.

export const BOBO_NAME = "bobo";

export function startBoboBot(): void {
  startTraderBot({
    name: BOBO_NAME,
    lockKey: 745_001_337,
    bankrollUsd: 1_500,
    minBuy: 15,
    maxBuy: 120,
    takeProfitPct: 8,
    maxPositions: 6,
    tickMs: 25_000,
  });
}
