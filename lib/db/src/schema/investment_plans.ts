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

export const investmentPlansTable = pgTable("investment_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  minAmount: numeric("min_amount", { precision: 18, scale: 8 }).notNull(),
  maxAmount: numeric("max_amount", { precision: 18, scale: 8 }).notNull(),
  dailyReturnRate: numeric("daily_return_rate", {
    precision: 10,
    scale: 6,
  }).notNull(),
  minRoiRate: numeric("min_roi_rate", { precision: 10, scale: 6 })
    .notNull()
    .default("0.025"),
  maxRoiRate: numeric("max_roi_rate", { precision: 10, scale: 6 })
    .notNull()
    .default("0.030"),
  durationDays: integer("duration_days").notNull(),
  riskLevel: text("risk_level").notNull().default("medium"),
  features: text("features").array().notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  isFeatured: boolean("is_featured").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertInvestmentPlanSchema = createInsertSchema(
  investmentPlansTable,
).omit({ id: true, createdAt: true });
export type InsertInvestmentPlan = z.infer<typeof insertInvestmentPlanSchema>;
export type InvestmentPlan = typeof investmentPlansTable.$inferSelect;
