import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { launchedCoinsTable } from "./launched-coins";

// Social posts written BY a coin's mascot persona (e.g. Zubu shilling his
// own coin). Rendered as an in-app Twitter-style feed on the coin page.
export const coinPostsTable = pgTable("coin_posts", {
  id: serial("id").primaryKey(),
  coinId: integer("coin_id").notNull().references(() => launchedCoinsTable.id),
  author: text("author").notNull(),          // e.g. "@zubuthecat"
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type CoinPost = typeof coinPostsTable.$inferSelect;
