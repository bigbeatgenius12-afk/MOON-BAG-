import { pgTable, text, serial, timestamp, real, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const launchedCoinsTable = pgTable("launched_coins", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ticker: text("ticker").notNull().unique(),
  description: text("description").notNull(),
  imageUrl: text("image_url"),
  creatorName: text("creator_name").notNull(),
  website: text("website"),
  twitter: text("twitter"),
  telegram: text("telegram"),
  contractAddress: text("contract_address").unique(),
  blockchain: text("blockchain"),
  launchpad: text("launchpad"),
  liquidity: real("liquidity").default(0),
  // SafeMoon-style tokenomics
  accRewardPerToken: real("acc_reward_per_token").notNull().default(0),
  rewardPool: real("reward_pool").notNull().default(0),
  totalBurned: real("total_burned").notNull().default(0),
  initialSupply: real("initial_supply").notNull(),
  price: real("price").notNull().default(0.000001),
  marketCap: real("market_cap").notNull().default(0),
  volume24h: real("volume_24h").notNull().default(0),
  holders: integer("holders").notNull().default(0),
  priceChange24h: real("price_change_24h").notNull().default(0),
  isRugProof: boolean("is_rug_proof").notNull().default(false),
  marketCapUnlock: real("market_cap_unlock"),
  hotspotUntil: timestamp("hotspot_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLaunchedCoinSchema = createInsertSchema(launchedCoinsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertLaunchedCoin = z.infer<typeof insertLaunchedCoinSchema>;
export type LaunchedCoin = typeof launchedCoinsTable.$inferSelect;
