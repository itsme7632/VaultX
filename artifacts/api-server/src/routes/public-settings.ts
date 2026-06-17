import { Router, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
import { db, platformSettingsTable } from "@workspace/db";

const router: IRouter = Router();

const PUBLIC_KEYS = [
  "min_deposit",
  "min_withdrawal",
  "withdrawal_fee_percent",
  "referral_commission_rate",
  "maintenance_mode",
  "announcement_text",
  "platform_name",
  "support_email",
  "support_telegram",
  "support_whatsapp",
  "deposit_instructions",
  "withdrawal_instructions",
  "app_download_url",
];

router.get("/settings/public", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(platformSettingsTable)
    .where(inArray(platformSettingsTable.key, PUBLIC_KEYS));

  const obj: Record<string, string> = {};
  for (const row of rows) obj[row.key] = row.value;

  const DEFAULTS: Record<string, string> = {
    min_deposit: "10",
    min_withdrawal: "10",
    withdrawal_fee_percent: "1.5",
    referral_commission_rate: "5",
    maintenance_mode: "false",
    announcement_text: "",
    platform_name: "VaultX",
    support_email: "",
    support_telegram: "",
    support_whatsapp: "",
    deposit_instructions: "",
    withdrawal_instructions: "",
    app_download_url: "",
  };

  for (const key of PUBLIC_KEYS) {
    if (!(key in obj)) obj[key] = DEFAULTS[key] ?? "";
  }

  res.json(obj);
});

export default router;
