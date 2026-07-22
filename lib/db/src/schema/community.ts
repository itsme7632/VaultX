import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const communityChannelsTable = pgTable("community_channels", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("chat"),
  description: text("description").notNull().default(""),
  isLocked: boolean("is_locked").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const communityMessagesTable = pgTable("community_messages", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  content: text("content").notNull().default(""),
  imageUrl: text("image_url"),
  replyToId: integer("reply_to_id"),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedBy: integer("deleted_by"),
  isPinned: boolean("is_pinned").notNull().default(false),
  isSystemMessage: boolean("is_system_message").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const communityReactionsTable = pgTable("community_reactions", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").notNull(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const communityReportsTable = pgTable("community_reports", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").notNull(),
  reporterId: integer("reporter_id").notNull().references(() => usersTable.id),
  reason: text("reason").notNull().default(""),
  status: text("status").notNull().default("pending"),
  reviewedBy: integer("reviewed_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const communityPinnedPostsTable = pgTable("community_pinned_posts", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull(),
  messageId: integer("message_id").notNull(),
  pinnedBy: integer("pinned_by").notNull().references(() => usersTable.id),
  pinnedAt: timestamp("pinned_at", { withTimezone: true }).notNull().defaultNow(),
});

export const communityBansTable = pgTable("community_bans", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  bannedBy: integer("banned_by").notNull().references(() => usersTable.id),
  reason: text("reason").notNull().default(""),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const communityMutesTable = pgTable("community_mutes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  mutedBy: integer("muted_by").notNull().references(() => usersTable.id),
  reason: text("reason").notNull().default(""),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const communityNotificationsTable = pgTable("community_notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  type: text("type").notNull(),
  messageId: integer("message_id"),
  channelId: integer("channel_id"),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const communityMembersTable = pgTable("community_members", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => usersTable.id),
  communityRole: text("community_role").notNull().default("member"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CommunityChannel = typeof communityChannelsTable.$inferSelect;
export type CommunityMessage = typeof communityMessagesTable.$inferSelect;
export type CommunityReaction = typeof communityReactionsTable.$inferSelect;
export type CommunityMember = typeof communityMembersTable.$inferSelect;
