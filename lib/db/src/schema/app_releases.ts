import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const appReleasesTable = pgTable("app_releases", {
  id: serial("id").primaryKey(),
  version: text("version").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  objectPath: text("object_path").notNull(),
  releaseNotes: text("release_notes"),
  isActive: boolean("is_active").notNull().default(false),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});
