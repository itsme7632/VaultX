import {
  pgTable,
  text,
  serial,
  timestamp,
  boolean,
  numeric,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { investmentPlansTable } from "./investment_plans";

export const userInvestmentsTable = pgTable("user_investments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id),
  planId: integer("plan_id")
    .notNull()
    .references(() => investmentPlansTable.id),
  amount: numeric("amount", { precision: 18, scale: 8 }).notNull(),
  pendingEarnings: numeric("pending_earnings", {
    precision: 18,
    scale: 8,
  })
    .notNull()
    .default("0"),
  totalEarned: numeric("total_earned", { precision: 18, scale: 8 })
    .notNull()
    .default("0"),
  dailyReturnRate: numeric("daily_return_rate", {
    precision: 10,
    scale: 6,
  }).notNull(),
  autoCompound: boolean("auto_compound").notNull().default(false),
  status: text("status").notNull().default("active"),
  startDate: timestamp("start_date", { withTimezone: true })
    .notNull()
    .defaultNow(),
  endDate: timestamp("end_date", { withTimezone: true }).notNull(),
  lastEarningAt: timestamp("last_earning_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertUserInvestmentSchema = createInsertSchema(
  userInvestmentsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUserInvestment = z.infer<typeof insertUserInvestmentSchema>;
export type UserInvestment = typeof userInvestmentsTable.$inferSelect;
