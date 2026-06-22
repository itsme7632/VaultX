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

export const referralsTable = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: integer("referrer_id")
    .notNull()
    .references(() => usersTable.id),
  referredId: integer("referred_id")
    .notNull()
    .references(() => usersTable.id),
  commissionAmount: numeric("commission_amount", {
    precision: 18,
    scale: 8,
  })
    .notNull()
    .default("0"),
  status: text("status").notNull().default("active"),
  referralSource: text("referral_source").default("direct"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertReferralSchema = createInsertSchema(referralsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type Referral = typeof referralsTable.$inferSelect;
