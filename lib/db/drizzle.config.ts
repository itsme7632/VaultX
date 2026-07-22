import { defineConfig } from "drizzle-kit";

// DATABASE_URL is required for push/migrate but not for generate.
// drizzle-kit generate compares schema files to the snapshot only.
const dbUrl = process.env.DATABASE_URL ?? "postgresql://localhost/placeholder";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
  },
});
