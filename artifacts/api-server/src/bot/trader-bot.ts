import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db, launchedCoinsTable, coinPositionsTable, tradesTable } from "@workspace/db";
import { logger } from "../lib/logger";

// ── Generic in-house trading bot engine ─────────────────────────────
// Powers Bobo and Zubu. Each bot has its own name, bankroll, strategy
// knobs, and advisory-lock key. All trades go through the real trade
// endpoint so fees, followers, price impact, and sell validation apply.

// Server-only credential shared by all house bots: the trade route rejects
// any request claiming a reserved bot identity unless it carries this token.
// Generated per process and never leaves the server.
export const BOT_INTERNAL_TOKEN = randomUUID();

// Trader names that only the server's own bots may use.
export const RESERVED_BOT_NAMES = ["bobo", "zubu"] as const;

export interface TraderBotConfig {
  name: string;            // reserved trader name, e.g. "bobo"
  lockKey: number;         // unique Postgres advisory lock key per bot
  bankrollUsd: number;     // fixed starting cash — the bot can never inject more
  minBuy: number;
  maxBuy: number;
  takeProfitPct: number;   // sell when a position is up this %+
  maxPositions: number;
  tickMs: number;
}

const GROSS_PER_NET = 1 / 0.9; // buy trades record net (90% of gross); see TOTAL_FEE in routes

// Available cash from the trade-history ledger. Reconstructed gross spend is
// rounded UP to the cent and earnings DOWN to the cent, so floating-point
// noise always errs on the side of showing LESS cash than truly available —
// the bankroll ceiling can never be exceeded by rounding error.
export function availableCash(bankrollUsd: number, spentGross: number, earned: number): number {
  const spent = Math.ceil(spentGross * 100) / 100;
  const credit = Math.floor(earned * 100) / 100;
  return bankrollUsd - spent + credit;
}

// Clamp a buy so its submitted gross can never exceed available cash:
// whole dollars only, always strictly at or below floor(cash), and never
// below the minimum viable order (returns 0 to signal "skip").
export function clampBuyAmount(desired: number, cash: number, minBuy: number): number {
  const amount = Math.min(Math.floor(desired), Math.floor(cash));
  return amount >= minBuy ? amount : 0;
}

function pick<T>(arr: T[]): T | undefined {
  return arr.length ? arr[Math.floor(Math.random() * arr.length)] : undefined;
}

async function trade(botName: string, coinId: number, type: "buy" | "sell", amountUsd: number): Promise<boolean> {
  const port = process.env["PORT"];
  if (!port) return false;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/launched-coins/${coinId}/trades`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-bot-token": BOT_INTERNAL_TOKEN },
      body: JSON.stringify({ type, amount_usd: amountUsd, trader_name: botName }),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch (err) {
    logger.warn({ err, botName, coinId, type }, "bot trade request failed");
    return false;
  }
}

async function tickLocked(cfg: TraderBotConfig): Promise<void> {
  const coins = await db.select().from(launchedCoinsTable);
  if (coins.length === 0) return;

  const positions = await db.select().from(coinPositionsTable)
    .where(eq(coinPositionsTable.traderName, cfg.name));

  // 1) Take profit: find a position that's nicely up
  for (const pos of positions) {
    const coin = coins.find((c) => c.id === pos.coinId);
    if (!coin || pos.tokensHeld <= 0 || pos.totalInvested <= 0) continue;
    const currentValue = pos.tokensHeld * coin.price;
    if (currentValue < 10) continue; // skip dust positions
    const gainPct = ((currentValue - pos.totalInvested) / pos.totalInvested) * 100;
    if (gainPct >= cfg.takeProfitPct) {
      // Sell about half the position (capped below holdings value)
      const sellUsd = Math.max(currentValue * 0.5, 5);
      if (await trade(cfg.name, coin.id, "sell", Math.min(sellUsd, currentValue * 0.9))) {
        logger.info({ bot: cfg.name, coin: coin.ticker, gainPct: gainPct.toFixed(1) }, "bot took profit");
        return; // one trade per tick keeps the feed natural
      }
    }
  }

  const held = positions.filter((p) => p.tokensHeld > 0);
  // Bankroll ledger: fixed cash wallet derived from the bot's full trade
  // history (buys debit gross spend, sells credit proceeds), so the
  // invariant "net injected funds <= bankroll" holds across restarts and is
  // immune to price motion or cost-basis accounting. The trade loop is
  // serialized (one trade per tick under an advisory lock), so the ledger
  // read and the subsequent trade cannot interleave with another bot trade.
  const [ledger] = await db.select({
    spentGross: sql<number>`coalesce(sum(case when ${tradesTable.type} = 'buy' then ${tradesTable.amountUsd} * ${GROSS_PER_NET} else 0 end), 0)`,
    earned: sql<number>`coalesce(sum(case when ${tradesTable.type} = 'sell' then ${tradesTable.amountUsd} else 0 end), 0)`,
  }).from(tradesTable).where(eq(tradesTable.traderName, cfg.name));
  const cash = availableCash(cfg.bankrollUsd, ledger?.spentGross ?? 0, ledger?.earned ?? 0);

  // 2a) Discover the founder's coins: sometimes ape into a coin created by
  // "you" even if it isn't dipping — creators gain followers when their
  // coins get traded, so the player's coins get organic bot attention.
  if (Math.random() < 0.3 && held.length < cfg.maxPositions && cash >= cfg.minBuy) {
    const heldIds = new Set(held.map((p) => p.coinId));
    const founders = coins.filter((c) => c.creatorName === "you" && !heldIds.has(c.id));
    const target = pick(founders);
    if (target) {
      const maxAffordable = Math.min(cfg.maxBuy, cash);
      const amount = clampBuyAmount(cfg.minBuy + Math.random() * (maxAffordable - cfg.minBuy), cash, cfg.minBuy);
      if (amount > 0 && await trade(cfg.name, target.id, "buy", amount)) {
        logger.info({ bot: cfg.name, coin: target.ticker, amount }, "bot aped into a founder coin");
        return;
      }
    }
  }

  // 2) Buy the dip: strictly unheld coins that moved down, paid from cash.
  if (held.length < cfg.maxPositions && cash >= cfg.minBuy) {
    const heldIds = new Set(held.map((p) => p.coinId));
    const dips = coins.filter((c) => !heldIds.has(c.id) && (c.priceChange24h ?? 0) < 0);
    const target = pick(dips); // strictly unheld dipping coins; skip buys when none qualify
    if (target) {
      const maxAffordable = Math.min(cfg.maxBuy, cash);
      const amount = clampBuyAmount(cfg.minBuy + Math.random() * (maxAffordable - cfg.minBuy), cash, cfg.minBuy);
      if (amount > 0 && await trade(cfg.name, target.id, "buy", amount)) {
        logger.info({ bot: cfg.name, coin: target.ticker, amount }, "bot bought the dip");
        return;
      }
    }
  }

  // 3) Occasionally cut a losing position a little (stop-loss behavior)
  if (Math.random() < 0.15) {
    const losers = held.filter((p) => {
      const coin = coins.find((c) => c.id === p.coinId);
      return coin && p.totalInvested > 0 && p.tokensHeld * coin.price < p.totalInvested;
    });
    const pos = pick(losers);
    if (pos) {
      const coin = coins.find((c) => c.id === pos.coinId);
      if (coin) {
        const currentValue = pos.tokensHeld * coin.price;
        if (currentValue > 10) await trade(cfg.name, coin.id, "sell", currentValue * 0.2);
      }
    }
  }
}

async function tick(cfg: TraderBotConfig): Promise<void> {
  // Cross-instance mutual exclusion: run the whole tick inside a transaction
  // holding a Postgres advisory lock. pg_try_advisory_xact_lock returns
  // false immediately if another instance is mid-tick for this bot, in which
  // case we skip this tick instead of racing on the same bankroll.
  await db.transaction(async (tx) => {
    const lockRows = await tx.execute(sql`select pg_try_advisory_xact_lock(${cfg.lockKey}) as locked`);
    const locked = (lockRows as unknown as Array<{ locked: boolean }>)[0]?.locked
      ?? (lockRows as unknown as { rows?: Array<{ locked: boolean }> }).rows?.[0]?.locked;
    if (!locked) {
      logger.debug({ bot: cfg.name }, "bot tick skipped: another instance holds the lock");
      return;
    }
    await tickLocked(cfg);
  });
}

export function startTraderBot(cfg: TraderBotConfig): void {
  // Self-scheduling loop: the next tick is only armed after the current one
  // finishes, so ticks can never overlap even if a request is slow.
  const loop = async (): Promise<void> => {
    try {
      await tick(cfg);
    } catch (err) {
      logger.warn({ err, bot: cfg.name }, "bot tick failed");
    }
    setTimeout(loop, cfg.tickMs);
  };
  // Small startup delay so the server is listening before the bot trades
  setTimeout(loop, 8_000);
  logger.info({ bot: cfg.name, bankroll: cfg.bankrollUsd }, "trading bot is live");
}
