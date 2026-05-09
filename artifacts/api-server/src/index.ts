import app from "./app";
import { logger } from "./lib/logger";
import { runMigrations, backfillTransactionIds } from "@workspace/db";
import { runSeed } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function main() {
  logger.info("Running database migrations…");
  await runMigrations();
  logger.info("Migrations complete ✓");

  logger.info("Running database seed…");
  await runSeed();
  logger.info("Seed complete ✓");

  logger.info("Backfilling transaction IDs…");
  await backfillTransactionIds();
  logger.info("Transaction ID backfill complete ✓");

  app.listen(port, (err?: Error) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
}

main().catch((err) => {
  logger.error({ err }, "Fatal startup error — exiting");
  process.exit(1);
});
