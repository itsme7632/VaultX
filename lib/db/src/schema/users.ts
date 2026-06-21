import {
  pgTable,
  text,
  serial,
  timestamp,
  boolean,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  displayId: text("display_id").unique(),
  fullName: text("full_name").notNull(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  whatsapp: text("whatsapp"),
  country: text("country"),
  passwordHash: text("password_hash").notNull(),
  avatarUrl: text("avatar_url"),
  referralCode: text("referral_code").notNull().unique(),
  referredBy: integer("referred_by"),
  kycStatus: text("kyc_status").notNull().default("none"),
  twoFaEnabled: boolean("two_fa_enabled").notNull().default(false),
  twoFaSecret: text("two_fa_secret"),
  withdrawalPasswordHash: text("withdrawal_password_hash"),
  isAdmin: boolean("is_admin").notNull().default(false),
  isVerified: boolean("is_verified").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  withdrawalLocked: boolean("withdrawal_locked").notNull().default(false),
  transferLocked: boolean("transfer_locked").notNull().default(false),
  whatsappLocked: boolean("whatsapp_locked").notNull().default(false),
  ipAddress: text("ip_address"),
  lastLoginIp: text("last_login_ip"),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
