import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const kycSubmissionsTable = pgTable("kyc_submissions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id),
  fullLegalName: text("full_legal_name").notNull().default(""),
  documentType: text("document_type").notNull(),
  documentNumber: text("document_number").notNull().default(""),
  country: text("country").notNull().default(""),
  frontImageUrl: text("front_image_url").notNull(),
  backImageUrl: text("back_image_url"),
  selfieUrl: text("selfie_url").notNull(),
  status: text("status").notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  submittedAt: timestamp("submitted_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
});

export const insertKycSubmissionSchema = createInsertSchema(
  kycSubmissionsTable,
).omit({ id: true, submittedAt: true });
export type InsertKycSubmission = z.infer<typeof insertKycSubmissionSchema>;
export type KycSubmission = typeof kycSubmissionsTable.$inferSelect;
