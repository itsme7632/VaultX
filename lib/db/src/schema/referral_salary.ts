import {
  pgTable,
  serial,
  integer,
  numeric,
  boolean,
  timestamp,
  text,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const referralSalaryTable = pgTable("referral_salary", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .unique()
    .references(() => usersTable.id),
  currentVolume: numeric("current_volume", { precision: 18, scale: 8 })
    .notNull()
    .default("0"),
  currentTier: integer("current_tier"),
  monthlySalary: numeric("monthly_salary", { precision: 18, scale: 8 })
    .notNull()
    .default("0"),
  nextPaymentDate: timestamp("next_payment_date", { withTimezone: true }),
  totalSalaryPaid: numeric("total_salary_paid", { precision: 18, scale: 8 })
    .notNull()
    .default("0"),
  isActive: boolean("is_active").notNull().default(true),
  lastCalculatedAt: timestamp("last_calculated_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type ReferralSalary = typeof referralSalaryTable.$inferSelect;
