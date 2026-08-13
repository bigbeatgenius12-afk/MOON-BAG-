import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { eq, desc, sql } from "drizzle-orm";
import { db, launchedCoinsTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { generateImageBuffer } from "@workspace/integrations-openai-ai-server/image";
import { logger } from "../lib/logger";

// ── Zubu the founder: he invents and launches his own coins ─────────
// Every few hours Zubu dreams up a brand-new meme coin (name, ticker,
// story), draws its logo himself, and launches it on Moon Bag under his
// own name. Bounded: at most one launch per interval (durable, DB-derived)
// and a hard cap on total Zubu-created coins.

const CREATOR_NAME = "zubu";
const LAUNCH_INTERVAL_MS = 4 * 60 * 60_000; // one new coin every ~4 hours
const FIRST_LAUNCH_DELAY_MS = 20_000;
const MAX_ZUBU_COINS = 8;                   // hard cap on coins Zubu may create
const CHECK_INTERVAL_MS = 10 * 60_000;      // re-check every 10 minutes

// Logos are written into the web app's public dir so they serve as /<file>
const PUBLIC_DIR = join(process.cwd(), "..", "moon-bag", "public");

async function inventAndLaunch(): Promise<void> {
  const zubuCoins = await db.select({
    ticker: launchedCoinsTable.ticker,
    name: launchedCoinsTable.name,
    createdAt: launchedCoinsTable.createdAt,
  }).from(launchedCoinsTable)
    .where(eq(launchedCoinsTable.creatorName, CREATOR_NAME))
    .orderBy(desc(launchedCoinsTable.createdAt));

  // Durable lease + hard cap (works across restarts and instances)
  if (zubuCoins.length >= MAX_ZUBU_COINS) return;
  const latest = zubuCoins[0];
  if (latest && Date.now() - latest.createdAt.getTime() < LAUNCH_INTERVAL_MS) return;

  const existing = await db.select({ ticker: launchedCoinsTable.ticker }).from(launchedCoinsTable);

  // 1) Zubu dreams up the coin
  const response = await openai.chat.completions.create({
    model: "gpt-5.6-terra",
    max_completion_tokens: 2048,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are Zubu, a cheerful green cartoon cat in a yellow hat who is also a legendary meme-coin founder on the Moon Bag exchange. Invent ONE brand-new meme coin concept. Be original, funny, and meme-worthy — animals, food, absurd mashups, internet culture. Respond as JSON: {"name": "...", "ticker": "...", "description": "...", "logo_prompt": "..."}.
- name: catchy coin name, max 30 chars
- ticker: 3-6 uppercase letters, must NOT be one of: ${existing.map((c) => c.ticker).join(", ")}
- description: 1-2 fun sentences selling the coin, max 200 chars, may include 1-2 emojis
- logo_prompt: a vivid one-sentence description of a square cartoon mascot logo for this coin (no text in the image)`,
      },
      {
        role: "user",
        content: `Your previous launches (make something totally different): ${zubuCoins.map((c) => `${c.name} (${c.ticker})`).join(", ") || "(none yet — this is your first!)"}`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) return;
  const idea = JSON.parse(raw) as { name: string; ticker: string; description: string; logo_prompt: string };
  const ticker = idea.ticker.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6);
  if (!idea.name || ticker.length < 3 || !idea.description) return;
  if (existing.some((c) => c.ticker === ticker)) return; // ticker collision — try next interval

  // 2) Zubu draws the logo himself
  let imageUrl: string | null = null;
  try {
    const buffer = await generateImageBuffer(
      `Square meme-coin mascot logo, vibrant cartoon style, bold clean shapes, no text, no letters: ${idea.logo_prompt}`,
      "1024x1024",
    );
    const fileName = `zubu-launch-${ticker.toLowerCase()}.png`;
    await writeFile(join(PUBLIC_DIR, fileName), buffer);
    imageUrl = `/${fileName}`;
  } catch (err) {
    logger.warn({ err }, "zubu logo generation failed — launching without logo");
  }

  // 3) Launch it
  const initialPrice = 0.000001;
  const initialSupply = 1_000_000_000;
  const [coin] = await db.insert(launchedCoinsTable).values({
    name: idea.name.slice(0, 30),
    ticker,
    description: `${idea.description.slice(0, 200)} — launched by Zubu himself 🐱`,
    imageUrl,
    creatorName: CREATOR_NAME,
    initialSupply,
    price: initialPrice,
    marketCap: initialSupply * initialPrice,
    volume24h: 0,
    holders: 0,
    priceChange24h: 0,
    hotspotUntil: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    isRugProof: false,
    marketCapUnlock: null,
    rewardPool: 0,
    totalBurned: 0,
    accRewardPerToken: 0,
    liquidity: 0,
  }).returning();

  logger.info({ coin: coin?.ticker, name: coin?.name }, "zubu launched a brand-new coin");
}

export function startZubuFounder(): void {
  const loop = async (): Promise<void> => {
    try {
      await inventAndLaunch();
    } catch (err) {
      logger.warn({ err }, "zubu coin launch failed");
    }
    setTimeout(loop, CHECK_INTERVAL_MS);
  };
  setTimeout(loop, FIRST_LAUNCH_DELAY_MS);
  logger.info("zubu founder mode is live");
}
