import {
  pgTable,
  text,
  serial,
  timestamp,
  numeric,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const walletsTable = pgTable("wallets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .unique()
    .references(() => usersTable.id),
  balance: numeric("balance", { precision: 18, scale: 8 }).notNull().default("0"),
  totalDeposited: numeric("total_deposited", { precision: 18, scale: 8 })
    .notNull()
    .default("0"),
  totalWithdrawn: numeric("total_withdrawn", { precision: 18, scale: 8 })
    .notNull()
    .default("0"),
  totalEarnings: numeric("total_earnings", { precision: 18, scale: 8 })
    .notNull()
    .default("0"),
  referralPendingEarnings: numeric("referral_pending_earnings", { precision: 18, scale: 8 })
    .notNull()
    .default("0"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const walletAddressesTable = pgTable("wallet_addresses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id),
  network: text("network").notNull(),
  address: text("address").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertWalletSchema = createInsertSchema(walletsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertWallet = z.infer<typeof insertWalletSchema>;
export type Wallet = typeof walletsTable.$inferSelect;
