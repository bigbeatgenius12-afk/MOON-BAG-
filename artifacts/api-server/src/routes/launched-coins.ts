import { Router, type IRouter } from "express";
import { randomInt } from "node:crypto";
import { eq, desc, sql, and } from "drizzle-orm";
import { db, launchedCoinsTable, tradesTable, coinPositionsTable, traderStatsTable, coinPostsTable, pendingOrdersTable } from "@workspace/db";
import {
  CreateLaunchedCoinBody,
  GetLaunchedCoinsResponse,
  GetLaunchedCoinResponse,
  GetLaunchedCoinStatsResponse,
  GetLaunchedCoinsQueryParams,
  GetCoinTradesResponse,
  GetCoinPositionResponse,
  CreateCoinTradeBody,
  CreateCoinTradeResponse,
  CreateLaunchedCoinResponse,
  ClaimCoinRewardsBody,
  ClaimCoinRewardsResponse,
  GetTraderStatsResponse,
  GetTraderPositionsResponse,
  GetTraderTradesResponse,
  GetCoinPostsResponse,
  CreateCoinOrderBody,
  CreateCoinOrderResponse,
  GetCoinOrdersResponse,
  CancelCoinOrderBody,
  CancelCoinOrderResponse,
} from "@workspace/api-zod";
import { RESERVED_BOT_NAMES, BOT_INTERNAL_TOKEN } from "../bot/trader-bot";
import {
  BuyCoinHotspotBody,
  BuyCoinHotspotResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const UNLOCK_MARKET_CAP = 58_000_000;

// ── Contract addresses ──
// Every coin gets a Solana-style base58 address ending in "moon" for flavor.
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function generateContractAddress(): string {
  let addr = "";
  for (let i = 0; i < 40; i++) {
    addr += BASE58_ALPHABET[randomInt(BASE58_ALPHABET.length)];
  }
  return addr + "moon";
}

// ── Live motion: every launched coin drifts on its own like a live market ──
const LIVE_MOTION_INTERVAL_MS = 5_000;
const LIVE_MOTION_MAX_DRIFT = 0.015; // up to ±1.5% per tick
const ZUBU_CLIMB_PER_TICK = 0.00001; // ZUBU's guaranteed climb every tick

// Self-scheduling loop: the next tick is only armed after the current one
// completes, so ticks never overlap and can't write stale prices.
async function liveMotionTick(): Promise<void> {
  try {
    const coins = await db.select().from(launchedCoinsTable);
    for (const coin of coins) {
      // Random walk with a slight upward bias so coins trend like fresh meme coins
      let drift = (Math.random() * 2 - 0.95) * LIVE_MOTION_MAX_DRIFT;
      // Rug-proof coins (BLUJO) never drop — clamp drift to upward only
      if (coin.isRugProof) drift = Math.abs(drift) * 0.3;
      let newPrice = Math.max(coin.price * (1 + drift), 0.0000001);
      // The Zubu Climb: ZUBU adds a guaranteed +$0.00001 every tick on top of
      // its wiggle, and can never close a tick below where it started —
      // the only coin that mathematically always climbs.
      if (coin.ticker === "ZUBU") {
        newPrice = Math.max(newPrice, coin.price) + ZUBU_CLIMB_PER_TICK;
        drift = (newPrice - coin.price) / coin.price;
      }
      const supply = Math.max(coin.initialSupply - coin.totalBurned, 1);
      await db.update(launchedCoinsTable).set({
        price: newPrice,
        marketCap: newPrice * supply,
        priceChange24h: coin.priceChange24h + drift * 100,
      }).where(eq(launchedCoinsTable.id, coin.id));
    }
  } catch {
    // ignore tick failures; next tick retries
  }
  try {
    await executeBuyTriggers();
  } catch {
    // ignore trigger failures; next tick retries
  }
  setTimeout(liveMotionTick, LIVE_MOTION_INTERVAL_MS);
}
setTimeout(liveMotionTick, LIVE_MOTION_INTERVAL_MS);

// ── Buy triggers: "when this coin's market cap hits X, spend my MGOAT on it" ──
// Executed through the public trade endpoint so fees, followers, price impact,
// and sell validation all apply exactly as if the trader placed the trades.
async function internalTrade(traderName: string, coinId: number, type: "buy" | "sell", amountUsd: number): Promise<{ amount_usd: number } | null> {
  const port = process.env["PORT"];
  if (!port) return null;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/launched-coins/${coinId}/trades`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-bot-token": BOT_INTERNAL_TOKEN },
      body: JSON.stringify({ type, amount_usd: amountUsd, trader_name: traderName }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return await res.json() as { amount_usd: number };
  } catch {
    return null;
  }
}

async function executeBuyTriggers(): Promise<void> {
  const open = await db.select().from(pendingOrdersTable).where(eq(pendingOrdersTable.status, "open"));
  if (open.length === 0) return;

  for (const order of open) {
    const [coin] = await db.select().from(launchedCoinsTable).where(eq(launchedCoinsTable.id, order.coinId));
    if (!coin) {
      await db.update(pendingOrdersTable).set({ status: "failed", failReason: "Coin no longer exists" })
        .where(and(eq(pendingOrdersTable.id, order.id), eq(pendingOrdersTable.status, "open")));
      continue;
    }
    if (coin.marketCap < order.targetMarketCap) continue;

    // Atomically claim the order (open → executing) so overlapping ticks or a
    // concurrent cancel can never double-execute it.
    const [claimed] = await db.update(pendingOrdersTable)
      .set({ status: "executing" })
      .where(and(eq(pendingOrdersTable.id, order.id), eq(pendingOrdersTable.status, "open")))
      .returning();
    if (!claimed) continue;

    // Re-read MGOAT fresh for every order — each swap moves its price.
    const [mgoat] = await db.select().from(launchedCoinsTable).where(eq(launchedCoinsTable.ticker, "MGOAT"));
    if (!mgoat) {
      await db.update(pendingOrdersTable).set({ status: "failed", failReason: "MGOAT market not found" }).where(eq(pendingOrdersTable.id, order.id));
      continue;
    }

    // Fire: sell the reserved MGOAT, then buy the coin with the proceeds.
    const [pos] = await db.select().from(coinPositionsTable).where(and(
      eq(coinPositionsTable.coinId, mgoat.id),
      eq(coinPositionsTable.traderName, order.traderName),
    ));
    if ((pos?.tokensHeld ?? 0) < order.mgoatAmount) {
      await db.update(pendingOrdersTable).set({ status: "failed", failReason: "Not enough MGOAT when the trigger fired" }).where(eq(pendingOrdersTable.id, order.id));
      continue;
    }
    const sell = await internalTrade(order.traderName, mgoat.id, "sell", order.mgoatAmount * mgoat.price);
    if (!sell) {
      await db.update(pendingOrdersTable).set({ status: "failed", failReason: "MGOAT swap failed" }).where(eq(pendingOrdersTable.id, order.id));
      continue;
    }
    const buy = await internalTrade(order.traderName, coin.id, "buy", sell.amount_usd);
    await db.update(pendingOrdersTable).set(
      buy
        ? { status: "executed", executedAt: new Date() }
        : { status: "failed", failReason: "Buy failed after the MGOAT swap" },
    ).where(eq(pendingOrdersTable.id, order.id));
  }
}

function formatOrder(o: typeof pendingOrdersTable.$inferSelect) {
  return {
    id: o.id,
    coin_id: o.coinId,
    trader_name: o.traderName,
    mgoat_amount: o.mgoatAmount,
    target_market_cap: o.targetMarketCap,
    status: o.status,
    fail_reason: o.failReason ?? null,
    created_at: o.createdAt.toISOString(),
    executed_at: o.executedAt ? o.executedAt.toISOString() : null,
  };
}

// SafeMoon-style fee breakdown (applied to every trade)
const TOTAL_FEE = 0.10;          // 10% total fee
const REFLECTION_SHARE = 0.50;   // 5% of gross → reflection pool (locked to $58M)
const LIQUIDITY_SHARE = 0.30;    // 3% of gross → liquidity
const BURN_SHARE = 0.20;         // 2% of gross → burned forever

function formatCoin(coin: typeof launchedCoinsTable.$inferSelect, buysCount = 0) {
  return {
    id: coin.id,
    name: coin.name,
    ticker: coin.ticker,
    description: coin.description,
    image_url: coin.imageUrl ?? null,
    creator_name: coin.creatorName,
    website: coin.website ?? null,
    twitter: coin.twitter ?? null,
    telegram: coin.telegram ?? null,
    contract_address: coin.contractAddress ?? null,
    blockchain: coin.blockchain ?? null,
    launchpad: coin.launchpad ?? null,
    liquidity: coin.liquidity ?? 0,
    initial_supply: coin.initialSupply,
    price: coin.price,
    market_cap: coin.marketCap,
    volume_24h: coin.volume24h,
    holders: coin.holders,
    buys_count: buysCount,
    price_change_24h: coin.priceChange24h,
    reward_pool: coin.rewardPool,
    total_burned: coin.totalBurned,
    is_rug_proof: coin.isRugProof,
    market_cap_unlock: coin.marketCapUnlock ?? null,
    hotspot_until: coin.hotspotUntil ? coin.hotspotUntil.toISOString() : null,
    created_at: coin.createdAt.toISOString(),
  };
}

function formatTrade(trade: typeof tradesTable.$inferSelect) {
  return {
    id: trade.id,
    coin_id: trade.coinId,
    trader_name: trade.traderName,
    type: trade.type as "buy" | "sell",
    amount_usd: trade.amountUsd,
    tokens: trade.tokens,
    price_at_trade: trade.priceAtTrade,
    created_at: trade.createdAt.toISOString(),
  };
}

// Harvest pending rewards for a position and return the amount
function calcPendingRewards(position: typeof coinPositionsTable.$inferSelect, accRewardPerToken: number): number {
  return Math.max(0, position.tokensHeld * accRewardPerToken - position.rewardDebt);
}

// ── Paid services (charged in MGOAT) ─────────────────────────────
const HOTSPOT_PRICE_USD = 100;
const HOTSPOT_DAYS = 28;
const LAUNCH_PROMO_DAYS = 28;   // every new coin is promoted free for 28 days

// Deduct `usd` worth of MGOAT from the trader's position. Returns error string or null.
async function chargeMgoat(traderName: string, usd: number): Promise<string | null> {
  const [mgoat] = await db.select().from(launchedCoinsTable).where(eq(launchedCoinsTable.ticker, "MGOAT"));
  if (!mgoat || mgoat.price <= 0) return "MGOAT is not available";
  const [pos] = await db.select().from(coinPositionsTable)
    .where(and(eq(coinPositionsTable.coinId, mgoat.id), eq(coinPositionsTable.traderName, traderName)));
  const heldUsd = (pos?.tokensHeld ?? 0) * mgoat.price;
  if (!pos || heldUsd < usd) {
    return `Not enough MGOAT — you need $${usd} worth, you hold $${heldUsd.toFixed(2)}`;
  }
  const tokensToCharge = usd / mgoat.price;
  const newTokens = pos.tokensHeld - tokensToCharge;
  const fraction = tokensToCharge / pos.tokensHeld;
  if (newTokens <= 0.000001) {
    await db.delete(coinPositionsTable).where(eq(coinPositionsTable.id, pos.id));
  } else {
    await db.update(coinPositionsTable).set({
      tokensHeld: newTokens,
      totalInvested: pos.totalInvested * (1 - fraction),
      rewardDebt: pos.rewardDebt * (1 - fraction),
      updatedAt: new Date(),
    }).where(eq(coinPositionsTable.id, pos.id));
  }
  return null;
}

// POST /launched-coins/:id/hotspot — $500 in MGOAT for 8 months of app-wide promotion
router.post("/launched-coins/:id/hotspot", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = BuyCoinHotspotBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [coin] = await db.select().from(launchedCoinsTable).where(eq(launchedCoinsTable.id, id));
  if (!coin) { res.status(404).json({ error: "Coin not found" }); return; }

  const chargeError = await chargeMgoat(parsed.data.trader_name, HOTSPOT_PRICE_USD);
  if (chargeError) { res.status(400).json({ error: chargeError }); return; }

  // Extend from the current hotspot end if still active
  const base = coin.hotspotUntil && coin.hotspotUntil > new Date() ? new Date(coin.hotspotUntil) : new Date();
  base.setDate(base.getDate() + HOTSPOT_DAYS);
  await db.update(launchedCoinsTable).set({ hotspotUntil: base }).where(eq(launchedCoinsTable.id, id));
  res.json(BuyCoinHotspotResponse.parse({
    success: true, mgoat_spent_usd: HOTSPOT_PRICE_USD, image_url: null, hotspot_until: base.toISOString(),
  }));
});

// Award followers to a trader (upsert). Bigger trades attract more followers.
async function gainFollowers(traderName: string, amount: number): Promise<void> {
  const gained = Math.max(1, Math.floor(Math.random() * 3) + Math.floor(amount / 50));
  await db.insert(traderStatsTable)
    .values({ traderName, followers: gained })
    .onConflictDoUpdate({
      target: traderStatsTable.traderName,
      set: {
        followers: sql`${traderStatsTable.followers} + ${gained}`,
        updatedAt: new Date(),
      },
    });
}

// GET /traders/:traderName/stats
router.get("/traders/:traderName/stats", async (req, res): Promise<void> => {
  const traderName = Array.isArray(req.params.traderName) ? req.params.traderName[0] : req.params.traderName;
  const [stats] = await db.select().from(traderStatsTable).where(eq(traderStatsTable.traderName, traderName));
  res.json(GetTraderStatsResponse.parse({
    trader_name: traderName,
    followers: stats?.followers ?? 0,
  }));
});

// GET /launched-coins/:id/posts — the coin mascot's own social feed
router.get("/launched-coins/:id/posts", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const posts = await db.select().from(coinPostsTable)
    .where(eq(coinPostsTable.coinId, id))
    .orderBy(desc(coinPostsTable.createdAt))
    .limit(30);

  res.json(GetCoinPostsResponse.parse(posts.map((p) => ({
    id: p.id,
    coin_id: p.coinId,
    author: p.author,
    content: p.content,
    created_at: p.createdAt.toISOString(),
  }))));
});

// GET /traders/:traderName/positions — all coin positions held by a trader
router.get("/traders/:traderName/positions", async (req, res): Promise<void> => {
  const traderName = Array.isArray(req.params.traderName) ? req.params.traderName[0] : req.params.traderName;
  const rows = await db.select({
    position: coinPositionsTable,
    coin: launchedCoinsTable,
  }).from(coinPositionsTable)
    .innerJoin(launchedCoinsTable, eq(coinPositionsTable.coinId, launchedCoinsTable.id))
    .where(eq(coinPositionsTable.traderName, traderName));

  res.json(GetTraderPositionsResponse.parse(
    rows.filter((r) => r.position.tokensHeld > 0).map((r) => {
      const currentValue = r.position.tokensHeld * r.coin.price;
      return {
        coin_id: r.coin.id,
        coin_name: r.coin.name,
        ticker: r.coin.ticker,
        image_url: r.coin.imageUrl ?? null,
        tokens_held: r.position.tokensHeld,
        total_invested: r.position.totalInvested,
        current_value: currentValue,
        profit: currentValue - r.position.totalInvested,
      };
    })
  ));
});

// GET /traders/:traderName/trades — recent trades across all coins
router.get("/traders/:traderName/trades", async (req, res): Promise<void> => {
  const traderName = Array.isArray(req.params.traderName) ? req.params.traderName[0] : req.params.traderName;
  const rows = await db.select({
    trade: tradesTable,
    coin: launchedCoinsTable,
  }).from(tradesTable)
    .innerJoin(launchedCoinsTable, eq(tradesTable.coinId, launchedCoinsTable.id))
    .where(eq(tradesTable.traderName, traderName))
    .orderBy(desc(tradesTable.createdAt))
    .limit(30);

  res.json(GetTraderTradesResponse.parse(rows.map((r) => ({
    id: r.trade.id,
    coin_id: r.coin.id,
    coin_name: r.coin.name,
    ticker: r.coin.ticker,
    image_url: r.coin.imageUrl ?? null,
    type: r.trade.type as "buy" | "sell",
    amount_usd: r.trade.amountUsd,
    tokens: r.trade.tokens,
    created_at: r.trade.createdAt.toISOString(),
  }))));
});

// GET /launched-coins
router.get("/launched-coins", async (req, res): Promise<void> => {
  const query = GetLaunchedCoinsQueryParams.safeParse(req.query);
  const sort = query.success ? (query.data.sort ?? "newest") : "newest";
  const limit = query.success ? (query.data.limit ?? 20) : 20;
  const ticker = query.success ? query.data.ticker : undefined;

  let coins;
  if (ticker) {
    coins = await db.select().from(launchedCoinsTable).where(eq(launchedCoinsTable.ticker, ticker.toUpperCase())).limit(limit);
  } else if (sort === "trending") {
    coins = await db.select().from(launchedCoinsTable).orderBy(desc(launchedCoinsTable.volume24h)).limit(limit);
  } else if (sort === "market_cap") {
    coins = await db.select().from(launchedCoinsTable).orderBy(desc(launchedCoinsTable.marketCap)).limit(limit);
  } else {
    coins = await db.select().from(launchedCoinsTable).orderBy(desc(launchedCoinsTable.createdAt)).limit(limit);
  }

  res.json(GetLaunchedCoinsResponse.parse(coins.map((c) => formatCoin(c))));
});

// GET /launched-coins/stats
router.get("/launched-coins/stats", async (req, res): Promise<void> => {
  const [totalResult, volumeResult, tradersResult, todayResult] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(launchedCoinsTable),
    db.select({ total: sql<number>`coalesce(sum(volume_24h), 0)` }).from(launchedCoinsTable),
    db.select({ count: sql<number>`count(distinct trader_name)::int` }).from(tradesTable),
    db.select({ count: sql<number>`count(*)::int` }).from(launchedCoinsTable).where(sql`created_at >= current_date`),
  ]);

  res.json(GetLaunchedCoinStatsResponse.parse({
    total_coins_launched: totalResult[0]?.count ?? 0,
    total_volume: volumeResult[0]?.total ?? 0,
    total_traders: tradersResult[0]?.count ?? 0,
    coins_launched_today: todayResult[0]?.count ?? 0,
  }));
});

// POST /launched-coins
router.post("/launched-coins", async (req, res): Promise<void> => {
  const parsed = CreateLaunchedCoinBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  const ticker = d.ticker.toUpperCase();

  // Idempotent by ticker: if the coin already exists, return it instead of duplicating.
  const [existing] = await db.select().from(launchedCoinsTable).where(eq(launchedCoinsTable.ticker, ticker));
  if (existing) {
    res.status(200).json(CreateLaunchedCoinResponse.parse(formatCoin(existing)));
    return;
  }

  const initialPrice = 0.000001;
  let coin;
  try {
    [coin] = await db.insert(launchedCoinsTable).values({
    name: d.name,
    ticker,
    description: d.description,
    imageUrl: d.image_url ?? null,
    creatorName: d.creator_name,
    website: d.website ?? null,
    twitter: d.twitter ?? null,
    telegram: d.telegram ?? null,
    contractAddress: generateContractAddress(),
    blockchain: "Mergegoat",
    initialSupply: d.initial_supply,
    price: initialPrice,
    marketCap: d.initial_supply * initialPrice,
    volume24h: 0,
    holders: 0,
    priceChange24h: 0,
    hotspotUntil: new Date(Date.now() + LAUNCH_PROMO_DAYS * 24 * 60 * 60 * 1000),
    isRugProof: false,
    marketCapUnlock: null,
    rewardPool: 0,
    totalBurned: 0,
    accRewardPerToken: 0,
    liquidity: 0,
  }).returning();
  } catch (err: unknown) {
    // Unique-violation race: another request created the same ticker first — return it.
    if (typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "23505") {
      const [raced] = await db.select().from(launchedCoinsTable).where(eq(launchedCoinsTable.ticker, ticker));
      if (raced) {
        res.status(200).json(CreateLaunchedCoinResponse.parse(formatCoin(raced)));
        return;
      }
    }
    throw err;
  }
  res.status(201).json(CreateLaunchedCoinResponse.parse(formatCoin(coin)));
});

// GET /launched-coins/:id
router.get("/launched-coins/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [[coin], buysResult] = await Promise.all([
    db.select().from(launchedCoinsTable).where(eq(launchedCoinsTable.id, id)),
    db.select({ count: sql<number>`count(*)::int` }).from(tradesTable)
      .where(and(eq(tradesTable.coinId, id), eq(tradesTable.type, "buy"))),
  ]);
  if (!coin) { res.status(404).json({ error: "Coin not found" }); return; }

  res.json(GetLaunchedCoinResponse.parse(formatCoin(coin, buysResult[0]?.count ?? 0)));
});

// GET /launched-coins/:id/position/:traderName
router.get("/launched-coins/:id/position/:traderName", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  const traderName = Array.isArray(req.params.traderName) ? req.params.traderName[0] : req.params.traderName;
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [coin] = await db.select().from(launchedCoinsTable).where(eq(launchedCoinsTable.id, id));
  if (!coin) { res.status(404).json({ error: "Coin not found" }); return; }

  const [position] = await db.select().from(coinPositionsTable)
    .where(and(eq(coinPositionsTable.coinId, id), eq(coinPositionsTable.traderName, traderName)));

  const unlocked = coin.marketCap >= UNLOCK_MARKET_CAP;

  if (!position) {
    res.json(GetCoinPositionResponse.parse({
      trader_name: traderName, coin_id: id,
      total_invested: 0, tokens_held: 0, current_value: 0,
      profit_locked: 0, locked_rewards: 0, pending_rewards: 0, unlocked,
    }));
    return;
  }

  const currentValue = position.tokensHeld * coin.price;
  const profitLocked = Math.max(0, currentValue - position.totalInvested);
  const pendingRewards = calcPendingRewards(position, coin.accRewardPerToken);

  res.json(GetCoinPositionResponse.parse({
    trader_name: traderName, coin_id: id,
    total_invested: position.totalInvested,
    tokens_held: position.tokensHeld,
    current_value: currentValue,
    profit_locked: unlocked ? 0 : profitLocked,
    locked_rewards: position.lockedRewards,
    pending_rewards: pendingRewards,
    unlocked,
  }));
});

// POST /launched-coins/:id/claim
router.post("/launched-coins/:id/claim", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = ClaimCoinRewardsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [coin] = await db.select().from(launchedCoinsTable).where(eq(launchedCoinsTable.id, id));
  if (!coin) { res.status(404).json({ error: "Coin not found" }); return; }

  if (coin.marketCap < UNLOCK_MARKET_CAP) {
    res.status(400).json(ClaimCoinRewardsResponse.parse({
      claimed: 0,
      message: `Market cap must reach $${(UNLOCK_MARKET_CAP / 1e6).toFixed(0)}M to unlock. Currently at $${(coin.marketCap / 1e6).toFixed(2)}M.`,
    }));
    return;
  }

  const [position] = await db.select().from(coinPositionsTable)
    .where(and(eq(coinPositionsTable.coinId, id), eq(coinPositionsTable.traderName, parsed.data.trader_name)));

  if (!position || (position.lockedRewards <= 0 && calcPendingRewards(position, coin.accRewardPerToken) <= 0)) {
    res.status(400).json(ClaimCoinRewardsResponse.parse({ claimed: 0, message: "Nothing to claim." }));
    return;
  }

  const pending = calcPendingRewards(position, coin.accRewardPerToken);
  const totalClaim = position.lockedRewards + pending;

  await db.update(coinPositionsTable).set({
    lockedRewards: 0,
    rewardDebt: position.tokensHeld * coin.accRewardPerToken,
    updatedAt: new Date(),
  }).where(eq(coinPositionsTable.id, position.id));

  res.json(ClaimCoinRewardsResponse.parse({
    claimed: totalClaim,
    message: `Successfully claimed $${totalClaim.toFixed(4)} in reflection rewards!`,
  }));
});

// GET /launched-coins/:id/trades
router.get("/launched-coins/:id/trades", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const trades = await db.select().from(tradesTable)
    .where(eq(tradesTable.coinId, id))
    .orderBy(desc(tradesTable.createdAt)).limit(50);

  res.json(GetCoinTradesResponse.parse(trades.map(formatTrade)));
});

// POST /launched-coins/:id/trades
router.post("/launched-coins/:id/trades", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = CreateCoinTradeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [coin] = await db.select().from(launchedCoinsTable).where(eq(launchedCoinsTable.id, id));
  if (!coin) { res.status(404).json({ error: "Coin not found" }); return; }

  const d = parsed.data;

  // ── Reserved bot identities: only the server's own bot loops may trade
  //    as a house bot (proven by a per-process internal token) ─────────
  if ((RESERVED_BOT_NAMES as readonly string[]).includes(d.trader_name.toLowerCase())) {
    if (req.headers["x-bot-token"] !== BOT_INTERNAL_TOKEN) {
      res.status(403).json({ error: "This trader name is reserved" });
      return;
    }
  }

  const grossAmount = d.amount_usd;
  const currentPrice = coin.price;

  // ── Validate sells against the trader's actual position ─────────
  if (d.type === "sell") {
    const [pos] = await db.select().from(coinPositionsTable)
      .where(and(eq(coinPositionsTable.coinId, id), eq(coinPositionsTable.traderName, d.trader_name)));
    const tokensRequested = (grossAmount * (1 - TOTAL_FEE)) / currentPrice;
    if (!pos || pos.tokensHeld <= 0) {
      res.status(400).json({ error: "You don't hold any of this coin" });
      return;
    }
    if (tokensRequested > pos.tokensHeld * 1.000001) {
      res.status(400).json({ error: "Sell amount exceeds your holdings" });
      return;
    }
  }

  // ── 10% SafeMoon-style fee ──────────────────────────────────────
  const fee = grossAmount * TOTAL_FEE;
  const netAmount = grossAmount - fee;                    // 90% effective trade
  const reflectionFee = fee * REFLECTION_SHARE;          // 5% gross → reflection
  const liquidityFee = fee * LIQUIDITY_SHARE;            // 3% gross → liquidity
  const burnValueUsd = fee * BURN_SHARE;                 // 2% gross → burn

  // Tokens burned = burn USD / current price
  const tokensBurned = burnValueUsd / currentPrice;
  const newSupply = Math.max(coin.initialSupply - tokensBurned, 1);

  // Update accRewardPerToken — distribute reflection to all holders
  const [totalHeldResult] = await db.select({
    total: sql<number>`coalesce(sum(tokens_held), 0)`,
  }).from(coinPositionsTable).where(eq(coinPositionsTable.coinId, id));
  const totalHeld = totalHeldResult?.total ?? 0;

  const newAccRewardPerToken = totalHeld > 0
    ? coin.accRewardPerToken + reflectionFee / totalHeld
    : coin.accRewardPerToken;

  const newRewardPool = coin.rewardPool + reflectionFee;
  const newLiquidity = (coin.liquidity ?? 0) + liquidityFee;
  const newTotalBurned = coin.totalBurned + tokensBurned;

  // ── Trade logic ──────────────────────────────────────────────────
  const tokens = netAmount / currentPrice;
  let newPrice: number;
  let amountReturned = netAmount;
  let newHolders = coin.holders;
  const unlocked = coin.marketCap >= UNLOCK_MARKET_CAP;

  if (coin.isRugProof) {
    if (d.type === "buy") {
      newPrice = currentPrice * 1.0015;
      newHolders = coin.holders + 1;
    } else {
      newPrice = currentPrice; // never drops on sell (rug-proof)
      newHolders = Math.max(coin.holders - 1, 0);
    }
  } else {
    newPrice = d.type === "buy"
      ? currentPrice * 1.001
      : Math.max(currentPrice * 0.9995, 0.0000001);
    newHolders = d.type === "buy" ? coin.holders + 1 : Math.max(coin.holders - 1, 0);
  }

  // ── MGOAT elastic supply: when ~90% of all coins are held, mint 10% more
  //    so the money supply keeps growing and MGOAT never runs out ──────────
  let finalSupply = newSupply;
  if (coin.ticker === "MGOAT" && d.type === "buy" && totalHeld + tokens > 0.9 * newSupply) {
    finalSupply = newSupply * 1.1;
  }

  const newMarketCap = newPrice * finalSupply;
  const newVolume = coin.volume24h + grossAmount;
  const priceChangePct = ((newPrice - currentPrice) / currentPrice) * 100;

  // ── Position update ──────────────────────────────────────────────
  const [existing] = await db.select().from(coinPositionsTable)
    .where(and(eq(coinPositionsTable.coinId, id), eq(coinPositionsTable.traderName, d.trader_name)));

  if (d.type === "buy") {
    if (existing) {
      // Harvest pending rewards before updating position
      const pending = calcPendingRewards(existing, newAccRewardPerToken);
      await db.update(coinPositionsTable).set({
        totalInvested: existing.totalInvested + grossAmount,
        tokensHeld: existing.tokensHeld + tokens,
        lockedRewards: existing.lockedRewards + pending,
        rewardDebt: (existing.tokensHeld + tokens) * newAccRewardPerToken,
        updatedAt: new Date(),
      }).where(eq(coinPositionsTable.id, existing.id));
    } else {
      await db.insert(coinPositionsTable).values({
        coinId: id,
        traderName: d.trader_name,
        totalInvested: grossAmount,
        tokensHeld: tokens,
        rewardDebt: tokens * newAccRewardPerToken,
        lockedRewards: 0,
      });
    }
  } else {
    // Sell
    if (existing) {
      const pending = calcPendingRewards(existing, newAccRewardPerToken);
      const tokensToSell = Math.min(tokens, existing.tokensHeld);

      if (coin.isRugProof && !unlocked) {
        // Principal only on sell — profit stays locked
        const fraction = tokensToSell / Math.max(existing.tokensHeld, 1);
        amountReturned = existing.totalInvested * fraction;
        const newTokens = existing.tokensHeld - tokensToSell;
        const newInvested = existing.totalInvested * (1 - fraction);
        if (newTokens <= 0) {
          await db.delete(coinPositionsTable).where(eq(coinPositionsTable.id, existing.id));
        } else {
          await db.update(coinPositionsTable).set({
            tokensHeld: newTokens,
            totalInvested: newInvested,
            lockedRewards: existing.lockedRewards + pending,
            rewardDebt: newTokens * newAccRewardPerToken,
            updatedAt: new Date(),
          }).where(eq(coinPositionsTable.id, existing.id));
        }
      } else {
        // Normal sell or unlocked rug-proof — full payout
        const newTokens = existing.tokensHeld - tokensToSell;
        if (newTokens <= 0) {
          await db.delete(coinPositionsTable).where(eq(coinPositionsTable.id, existing.id));
        } else {
          await db.update(coinPositionsTable).set({
            tokensHeld: newTokens,
            // Reduce cost basis proportionally to tokens sold so the
            // principal ledger stays correct even after price appreciation
            totalInvested: existing.totalInvested * (1 - tokensToSell / existing.tokensHeld),
            lockedRewards: existing.lockedRewards + pending,
            rewardDebt: newTokens * newAccRewardPerToken,
            updatedAt: new Date(),
          }).where(eq(coinPositionsTable.id, existing.id));
        }
      }
    }
  }

  // ── Social: trading gains you followers; the coin's creator gains some too ──
  await gainFollowers(d.trader_name, grossAmount);
  if (coin.creatorName !== d.trader_name) {
    await gainFollowers(coin.creatorName, grossAmount / 2);
  }

  // ── Record the trade ─────────────────────────────────────────────
  const [trade] = await db.insert(tradesTable).values({
    coinId: id,
    traderName: d.trader_name,
    type: d.type as "buy" | "sell",
    amountUsd: amountReturned,
    tokens,
    priceAtTrade: currentPrice,
  }).returning();

  // ── Update coin ──────────────────────────────────────────────────
  await db.update(launchedCoinsTable).set({
    price: newPrice,
    marketCap: newMarketCap,
    volume24h: newVolume,
    holders: newHolders,
    priceChange24h: priceChangePct,
    initialSupply: finalSupply,
    accRewardPerToken: newAccRewardPerToken,
    rewardPool: newRewardPool,
    totalBurned: newTotalBurned,
    liquidity: newLiquidity,
  }).where(eq(launchedCoinsTable.id, id));

  res.status(201).json(CreateCoinTradeResponse.parse(formatTrade(trade)));
});

// POST /launched-coins/:id/orders — create a buy trigger
router.post("/launched-coins/:id/orders", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = CreateCoinOrderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;

  if ((RESERVED_BOT_NAMES as readonly string[]).includes(d.trader_name.toLowerCase())) {
    res.status(403).json({ error: "Reserved trader name" }); return;
  }
  const [coin] = await db.select().from(launchedCoinsTable).where(eq(launchedCoinsTable.id, id));
  if (!coin) { res.status(404).json({ error: "Coin not found" }); return; }
  if (coin.ticker === "MGOAT") { res.status(400).json({ error: "Triggers pay with MGOAT, so they can't target MGOAT itself" }); return; }

  // Require the MGOAT up front so triggers aren't written checks that bounce.
  const [mgoat] = await db.select().from(launchedCoinsTable).where(eq(launchedCoinsTable.ticker, "MGOAT"));
  if (!mgoat) { res.status(500).json({ error: "MGOAT market not found" }); return; }
  const [pos] = await db.select().from(coinPositionsTable).where(and(
    eq(coinPositionsTable.coinId, mgoat.id),
    eq(coinPositionsTable.traderName, d.trader_name),
  ));
  const held = pos?.tokensHeld ?? 0;
  const [reserved] = await db.select({
    total: sql<number>`coalesce(sum(${pendingOrdersTable.mgoatAmount}), 0)`,
  }).from(pendingOrdersTable).where(and(
    eq(pendingOrdersTable.traderName, d.trader_name),
    eq(pendingOrdersTable.status, "open"),
  ));
  if (held - (reserved?.total ?? 0) < d.mgoat_amount) {
    res.status(400).json({ error: "Not enough MGOAT to back this trigger" }); return;
  }

  const [order] = await db.insert(pendingOrdersTable).values({
    coinId: id,
    traderName: d.trader_name,
    mgoatAmount: d.mgoat_amount,
    targetMarketCap: d.target_market_cap,
  }).returning();
  res.status(201).json(CreateCoinOrderResponse.parse(formatOrder(order)));
});

// GET /launched-coins/:id/orders/:traderName — list a trader's triggers for a coin
router.get("/launched-coins/:id/orders/:traderName", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const traderName = Array.isArray(req.params.traderName) ? req.params.traderName[0] : req.params.traderName;
  const orders = await db.select().from(pendingOrdersTable).where(and(
    eq(pendingOrdersTable.coinId, id),
    eq(pendingOrdersTable.traderName, traderName),
  )).orderBy(desc(pendingOrdersTable.createdAt));
  res.json(GetCoinOrdersResponse.parse(orders.map(formatOrder)));
});

// POST /orders/:orderId/cancel — cancel an open trigger
router.post("/orders/:orderId/cancel", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId;
  const orderId = parseInt(raw, 10);
  if (isNaN(orderId)) { res.status(400).json({ error: "Invalid order id" }); return; }
  const parsed = CancelCoinOrderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [order] = await db.select().from(pendingOrdersTable).where(eq(pendingOrdersTable.id, orderId));
  if (!order || order.traderName !== parsed.data.trader_name) {
    res.status(404).json({ error: "Order not found" }); return;
  }
  if (order.status !== "open") { res.status(400).json({ error: "Order is no longer open" }); return; }
  const [updated] = await db.update(pendingOrdersTable)
    .set({ status: "cancelled" })
    .where(and(eq(pendingOrdersTable.id, orderId), eq(pendingOrdersTable.status, "open")))
    .returning();
  if (!updated) { res.status(400).json({ error: "Order is no longer open" }); return; }
  res.json(CancelCoinOrderResponse.parse(formatOrder(updated)));
});

export default router;
