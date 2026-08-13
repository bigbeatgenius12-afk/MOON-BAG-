import { pgTable, text, serial, timestamp, real, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { launchedCoinsTable } from "./launched-coins";

export const tradesTable = pgTable("trades", {
  id: serial("id").primaryKey(),
  coinId: integer("coin_id")
    .notNull()
    .references(() => launchedCoinsTable.id, { onDelete: "cascade" }),
  traderName: text("trader_name").notNull(),
  type: text("type", { enum: ["buy", "sell"] }).notNull(),
  amountUsd: real("amount_usd").notNull(),
  tokens: real("tokens").notNull(),
  priceAtTrade: real("price_at_trade").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTradeSchema = createInsertSchema(tradesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Trade = typeof tradesTable.$inferSelect;
