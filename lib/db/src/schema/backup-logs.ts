import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  bigint,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const backupLogsTable = pgTable("backup_logs", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id")
    .notNull()
    .references(() => usersTable.id),
  type: text("type").notNull(), // "backup" | "restore" | "validate"
  status: text("status").notNull().default("pending"), // "pending" | "success" | "failed"
  backupVersion: text("backup_version"),
  schemaVersion: text("schema_version"),
  tableCount: integer("table_count"),
  recordCount: integer("record_count"),
  fileSizeBytes: bigint("file_size_bytes", { mode: "number" }),
  checksum: text("checksum"),
  fileName: text("file_name"),
  errorMessage: text("error_message"),
  restoreMode: text("restore_mode"), // "full" | "merge"
  preRestoreBackupId: integer("pre_restore_backup_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type BackupLog = typeof backupLogsTable.$inferSelect;
