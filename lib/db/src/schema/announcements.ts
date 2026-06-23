import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const announcementsTable = pgTable("announcements", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  isActive: boolean("is_active").notNull().default(false),
  priority: integer("priority").notNull().default(0),
  showToNewUsers: boolean("show_to_new_users").notNull().default(true),
  showToExistingUsers: boolean("show_to_existing_users").notNull().default(true),
  isPinned: boolean("is_pinned").notNull().default(false),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  createdBy: integer("created_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const announcementViewsTable = pgTable("announcement_views", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  announcementId: integer("announcement_id").notNull().references(() => announcementsTable.id),
  viewedAt: timestamp("viewed_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Announcement = typeof announcementsTable.$inferSelect;
export type AnnouncementView = typeof announcementViewsTable.$inferSelect;
