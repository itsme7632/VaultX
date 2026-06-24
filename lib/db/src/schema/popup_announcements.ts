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
import { usersTable } from "./users";

export const popupAnnouncementsTable = pgTable("popup_announcements", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  isPinned: boolean("is_pinned").notNull().default(false),
  showToNewUsers: boolean("show_to_new_users").notNull().default(true),
  showToExistingUsers: boolean("show_to_existing_users").notNull().default(true),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdBy: integer("created_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertPopupAnnouncementSchema = createInsertSchema(popupAnnouncementsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPopupAnnouncement = z.infer<typeof insertPopupAnnouncementSchema>;
export type PopupAnnouncement = typeof popupAnnouncementsTable.$inferSelect;
