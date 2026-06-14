import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const sslConfig =
  process.env.NODE_ENV === "production"
    ? { ssl: { rejectUnauthorized: false } }
    : {};

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ...sslConfig,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
export { runMigrations, backfillTransactionIds } from "./migrate";
export { runSeed } from "./seed";
