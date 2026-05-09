import {
  pgTable,
  text,
  serial,
  timestamp,
  boolean,
  numeric,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const depositNetworksTable = pgTable("deposit_networks", {
  id: serial("id").primaryKey(),
  network: text("network").notNull().unique(),
  label: text("label").notNull(),
  walletAddress: text("wallet_address").notNull(),
  minDeposit: numeric("min_deposit", { precision: 18, scale: 8 })
    .notNull()
    .default("10"),
  networkFee: numeric("network_fee", { precision: 18, scale: 8 })
    .notNull()
    .default("1"),
  confirmationTime: text("confirmation_time").notNull().default("10-30 minutes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertDepositNetworkSchema = createInsertSchema(
  depositNetworksTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDepositNetwork = z.infer<typeof insertDepositNetworkSchema>;
export type DepositNetwork = typeof depositNetworksTable.$inferSelect;
