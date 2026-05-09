import cron from "node-cron";
import { processAllInvestments } from "./roi-engine";
import { logger } from "./logger";

export function startCronJobs(): void {
  // Run once at startup to catch any overdue investment cycles
  setTimeout(async () => {
    logger.info("ROI startup: processing any overdue investments");
    try {
      await processAllInvestments();
    } catch (err) {
      logger.error({ err }, "ROI startup: error during startup processing");
    }
  }, 4000);

  // Then run every hour at the top of the hour
  cron.schedule("0 * * * *", async () => {
    logger.info("ROI cron: starting hourly investment processing");
    try {
      await processAllInvestments();
    } catch (err) {
      logger.error({ err }, "ROI cron: error processing investments");
    }
  });

  logger.info("Cron jobs started: ROI processing every hour + startup check");
}
