import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

export const withdrawalAddressesTable = pgTable("withdrawal_addresses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  network: text("network").notNull(),
  address: text("address").notNull(),
  label: text("label").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
