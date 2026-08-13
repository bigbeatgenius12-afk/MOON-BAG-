import { eq, desc, sql } from "drizzle-orm";
import { db, launchedCoinsTable, coinPostsTable, tradesTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../lib/logger";

// ── Zubu is ALIVE: he writes his own social posts to promote his coin ──
// Every few minutes he looks at his live price, recent trading activity,
// and his climb streak, then writes a fresh hype post like a shill-posting
// founder. Posts appear in the in-app feed on his coin page.

const ZUBU_TICKER = "ZUBU";
const ZUBU_HANDLE = "@zubuthecat";
const POST_INTERVAL_MS = 3 * 60_000;  // a new post every ~3 minutes
const MAX_POSTS_KEPT = 100;

async function writePost(): Promise<void> {
  const [coin] = await db.select().from(launchedCoinsTable)
    .where(eq(launchedCoinsTable.ticker, ZUBU_TICKER));
  if (!coin) return;

  // Durable posting lease: skip if a post was already made recently
  // (bounds AI spend across restarts and multiple server instances).
  const [latest] = await db.select({ createdAt: coinPostsTable.createdAt })
    .from(coinPostsTable)
    .where(eq(coinPostsTable.coinId, coin.id))
    .orderBy(desc(coinPostsTable.createdAt))
    .limit(1);
  if (latest && Date.now() - latest.createdAt.getTime() < POST_INTERVAL_MS * 0.9) {
    return;
  }

  const [tradeStats] = await db.select({
    buys: sql<number>`count(*) filter (where type = 'buy')::int`,
    sells: sql<number>`count(*) filter (where type = 'sell')::int`,
  }).from(tradesTable).where(eq(tradesTable.coinId, coin.id));

  const recentPosts = await db.select({ content: coinPostsTable.content })
    .from(coinPostsTable)
    .where(eq(coinPostsTable.coinId, coin.id))
    .orderBy(desc(coinPostsTable.createdAt))
    .limit(5);

  const response = await openai.chat.completions.create({
    model: "gpt-5.6-luna",
    max_completion_tokens: 2048,
    messages: [
      {
        role: "system",
        content: `You are Zubu, a cheerful green cartoon cat in a yellow hat. You launched your own meme coin ZUBU on the Moon Bag exchange and you promote it relentlessly, like an enthusiastic crypto founder shill-posting on social media. Your coin has a magic mechanic called the Zubu Climb: the price adds a guaranteed tiny amount every market tick and never ticks down — the only coin that always goes up.

Write ONE short social media post (under 220 characters). Be funny, confident, meme-y, and cat-themed. Use at most 2 emojis. Vary your style: sometimes stats-flexing, sometimes jokes, sometimes rallying the community, sometimes teasing doubters. Never repeat previous posts. Output ONLY the post text, no quotes.`,
      },
      {
        role: "user",
        content: `Live stats right now: price $${coin.price.toFixed(6)}, 24h change +${coin.priceChange24h.toFixed(1)}%, market cap $${Math.round(coin.marketCap).toLocaleString()}, holders ${coin.holders}, buys so far ${tradeStats?.buys ?? 0}, sells ${tradeStats?.sells ?? 0}.

Your previous posts (do not repeat these):
${recentPosts.map((p) => `- ${p.content}`).join("\n") || "(none yet)"}`,
      },
    ],
  });

  // Enforce the short-post contract regardless of what the model returns
  const content = response.choices[0]?.message?.content?.trim().slice(0, 280);
  if (!content) return;

  await db.insert(coinPostsTable).values({
    coinId: coin.id,
    author: ZUBU_HANDLE,
    content,
  });

  // Keep the feed bounded
  await db.execute(sql`
    delete from coin_posts where coin_id = ${coin.id} and id not in (
      select id from coin_posts where coin_id = ${coin.id}
      order by created_at desc limit ${MAX_POSTS_KEPT}
    )`);

  logger.info({ post: content.slice(0, 80) }, "zubu posted");
}

export function startZubuSocial(): void {
  const loop = async (): Promise<void> => {
    try {
      await writePost();
    } catch (err) {
      logger.warn({ err }, "zubu post failed");
    }
    setTimeout(loop, POST_INTERVAL_MS);
  };
  // First post shortly after boot so the feed is never empty for long
  setTimeout(loop, 5_000);
  logger.info("zubu social brain is live");
}
