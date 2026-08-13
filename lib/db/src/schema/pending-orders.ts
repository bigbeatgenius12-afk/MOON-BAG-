import { pgTable, text, serial, timestamp, real, integer } from "drizzle-orm/pg-core";

// Buy triggers: "when this coin's market cap hits X, spend my MGOAT on it".
// Paid in MGOAT (the app's buy currency) so the whole flow is server-side —
// the trader's cash wallet is client-local, but MGOAT positions live in the DB.
export const pendingOrdersTable = pgTable("pending_orders", {
  id: serial("id").primaryKey(),
  coinId: integer("coin_id").notNull(),
  traderName: text("trader_name").notNull(),
  mgoatAmount: real("mgoat_amount").notNull(),
  targetMarketCap: real("target_market_cap").notNull(),
  status: text("status").notNull().default("open"), // open | executed | failed | cancelled
  failReason: text("fail_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  executedAt: timestamp("executed_at", { withTimezone: true }),
});

export type PendingOrder = typeof pendingOrdersTable.$inferSelect;
