import { pgTable, text, serial, timestamp, real, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { launchedCoinsTable } from "./launched-coins";

export const coinPositionsTable = pgTable("coin_positions", {
  id: serial("id").primaryKey(),
  coinId: integer("coin_id")
    .notNull()
    .references(() => launchedCoinsTable.id, { onDelete: "cascade" }),
  traderName: text("trader_name").notNull(),
  totalInvested: real("total_invested").notNull().default(0),
  tokensHeld: real("tokens_held").notNull().default(0),
  rewardDebt: real("reward_debt").notNull().default(0),
  lockedRewards: real("locked_rewards").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCoinPositionSchema = createInsertSchema(coinPositionsTable).omit({
  id: true,
  updatedAt: true,
});
export type InsertCoinPosition = z.infer<typeof insertCoinPositionSchema>;
export type CoinPosition = typeof coinPositionsTable.$inferSelect;
