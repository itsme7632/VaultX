import { Router, type IRouter } from "express";
import { inArray } from "drizzle-orm";
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
  "platform_logo_url",
  "platform_url",
  "support_email",
  "support_telegram",
  "support_whatsapp",
  "support_whatsapp_community",
  "support_telegram_group",
  "deposit_instructions",
  "withdrawal_instructions",
  "app_download_url",
  "activity_feed_mode",
  "feed_enable_deposits",
  "feed_enable_investments",
  "feed_enable_withdrawals",
  "feed_enable_earnings",
  "feed_enable_referrals",
  "feed_min_amount",
  "feed_max_amount",
  "feed_frequency_seconds",
  "feed_username_style",
  "privacy_policy_content",
  "privacy_policy_updated",
  "terms_content",
  "terms_updated",
  "kyc_enabled",
  "maintenance_eta",
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
    platform_name: "Wexora",
    support_email: "",
    support_telegram: "",
    support_whatsapp: "",
    support_whatsapp_community: "",
    support_telegram_group: "",
    deposit_instructions: "",
    withdrawal_instructions: "",
    app_download_url: "",
    privacy_policy_content: "",
    privacy_policy_updated: "",
    terms_content: "",
    terms_updated: "",
    kyc_enabled: "true",
    maintenance_eta: "",
  };

  for (const key of PUBLIC_KEYS) {
    if (!(key in obj)) obj[key] = DEFAULTS[key] ?? "";
  }

  res.json(obj);
});

export default router;
