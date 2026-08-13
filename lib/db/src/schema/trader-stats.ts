import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const traderStatsTable = pgTable("trader_stats", {
  id: serial("id").primaryKey(),
  traderName: text("trader_name").notNull().unique(),
  followers: integer("followers").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
