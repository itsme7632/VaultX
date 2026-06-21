import pg from "pg";

const { Pool } = pg;

const TABLES_SQL = [
  `CREATE TABLE IF NOT EXISTS "session" (
    "sid" text PRIMARY KEY NOT NULL,
    "sess" text NOT NULL,
    "expire" timestamp with time zone NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "users" (
    "id" serial PRIMARY KEY NOT NULL,
    "display_id" text,
    "full_name" text NOT NULL,
    "username" text NOT NULL,
    "email" text NOT NULL,
    "whatsapp" text,
    "country" text,
    "password_hash" text NOT NULL,
    "avatar_url" text,
    "referral_code" text NOT NULL,
    "referred_by" integer,
    "kyc_status" text DEFAULT 'none' NOT NULL,
    "two_fa_enabled" boolean DEFAULT false NOT NULL,
    "two_fa_secret" text,
    "is_admin" boolean DEFAULT false NOT NULL,
    "is_verified" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "withdrawal_locked" boolean DEFAULT false NOT NULL,
    "transfer_locked" boolean DEFAULT false NOT NULL,
    "whatsapp_locked" boolean DEFAULT false NOT NULL,
    "ip_address" text,
    "last_login_ip" text,
    "last_login_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "users_display_id_unique" UNIQUE("display_id"),
    CONSTRAINT "users_username_unique" UNIQUE("username"),
    CONSTRAINT "users_email_unique" UNIQUE("email"),
    CONSTRAINT "users_referral_code_unique" UNIQUE("referral_code")
  )`,

  `CREATE TABLE IF NOT EXISTS "investment_plans" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "description" text NOT NULL,
    "min_amount" numeric(18, 8) NOT NULL,
    "max_amount" numeric(18, 8) NOT NULL,
    "daily_return_rate" numeric(10, 6) NOT NULL,
    "min_roi_rate" numeric(10, 6) DEFAULT '0.025' NOT NULL,
    "max_roi_rate" numeric(10, 6) DEFAULT '0.030' NOT NULL,
    "duration_days" integer NOT NULL,
    "risk_level" text DEFAULT 'medium' NOT NULL,
    "features" text[] DEFAULT '{}' NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "wallets" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer NOT NULL,
    "balance" numeric(18, 8) DEFAULT '0' NOT NULL,
    "total_deposited" numeric(18, 8) DEFAULT '0' NOT NULL,
    "total_withdrawn" numeric(18, 8) DEFAULT '0' NOT NULL,
    "total_earnings" numeric(18, 8) DEFAULT '0' NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "wallets_user_id_unique" UNIQUE("user_id")
  )`,

  `CREATE TABLE IF NOT EXISTS "wallet_addresses" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer NOT NULL,
    "network" text NOT NULL,
    "address" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "transactions" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer NOT NULL,
    "type" text NOT NULL,
    "amount" numeric(18, 8) NOT NULL,
    "fee" numeric(18, 8) DEFAULT '0' NOT NULL,
    "status" text DEFAULT 'pending' NOT NULL,
    "network" text,
    "tx_hash" text,
    "address" text,
    "note" text,
    "tx_id" text,
    "metadata" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "user_investments" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer NOT NULL,
    "plan_id" integer NOT NULL,
    "amount" numeric(18, 8) NOT NULL,
    "pending_earnings" numeric(18, 8) DEFAULT '0' NOT NULL,
    "total_earned" numeric(18, 8) DEFAULT '0' NOT NULL,
    "daily_return_rate" numeric(10, 6) NOT NULL,
    "auto_compound" boolean DEFAULT false NOT NULL,
    "status" text DEFAULT 'active' NOT NULL,
    "start_date" timestamp with time zone DEFAULT now() NOT NULL,
    "end_date" timestamp with time zone NOT NULL,
    "last_earning_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "referrals" (
    "id" serial PRIMARY KEY NOT NULL,
    "referrer_id" integer NOT NULL,
    "referred_id" integer NOT NULL,
    "commission_amount" numeric(18, 8) DEFAULT '0' NOT NULL,
    "status" text DEFAULT 'active' NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "notifications" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer,
    "type" text DEFAULT 'announcement' NOT NULL,
    "title" text NOT NULL,
    "message" text NOT NULL,
    "is_read" boolean DEFAULT false NOT NULL,
    "is_broadcast" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "kyc_submissions" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer NOT NULL,
    "full_legal_name" text DEFAULT '' NOT NULL,
    "document_type" text NOT NULL,
    "document_number" text DEFAULT '' NOT NULL,
    "country" text DEFAULT '' NOT NULL,
    "front_image_url" text NOT NULL,
    "back_image_url" text,
    "selfie_url" text NOT NULL,
    "status" text DEFAULT 'pending' NOT NULL,
    "rejection_reason" text,
    "submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
    "reviewed_at" timestamp with time zone
  )`,

  `CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer NOT NULL,
    "token" text NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
  )`,

  `CREATE TABLE IF NOT EXISTS "news_posts" (
    "id" serial PRIMARY KEY NOT NULL,
    "title" text NOT NULL,
    "content" text NOT NULL,
    "excerpt" text DEFAULT '' NOT NULL,
    "category" text DEFAULT 'announcement' NOT NULL,
    "image_url" text,
    "is_featured" boolean DEFAULT false NOT NULL,
    "is_published" boolean DEFAULT false NOT NULL,
    "published_at" timestamp with time zone,
    "created_by" integer,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "support_tickets" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer NOT NULL,
    "subject" text NOT NULL,
    "status" text DEFAULT 'open' NOT NULL,
    "priority" text DEFAULT 'normal' NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "closed_at" timestamp with time zone
  )`,

  `CREATE TABLE IF NOT EXISTS "support_messages" (
    "id" serial PRIMARY KEY NOT NULL,
    "ticket_id" integer NOT NULL,
    "user_id" integer NOT NULL,
    "is_admin" boolean DEFAULT false NOT NULL,
    "message" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "deposit_networks" (
    "id" serial PRIMARY KEY NOT NULL,
    "network" text NOT NULL,
    "label" text NOT NULL,
    "wallet_address" text NOT NULL,
    "min_deposit" numeric(18, 8) DEFAULT '10' NOT NULL,
    "network_fee" numeric(18, 8) DEFAULT '1' NOT NULL,
    "confirmation_time" text DEFAULT '10-30 minutes' NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "deposit_networks_network_unique" UNIQUE("network")
  )`,

  `CREATE TABLE IF NOT EXISTS "platform_settings" (
    "id" serial PRIMARY KEY NOT NULL,
    "key" text NOT NULL,
    "value" text NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "platform_settings_key_unique" UNIQUE("key")
  )`,

  `CREATE TABLE IF NOT EXISTS "admin_action_logs" (
    "id" serial PRIMARY KEY NOT NULL,
    "admin_id" integer NOT NULL,
    "target_user_id" integer NOT NULL,
    "action" text NOT NULL,
    "details" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "app_releases" (
    "id" serial PRIMARY KEY NOT NULL,
    "version" text NOT NULL,
    "file_name" text NOT NULL,
    "file_size" integer NOT NULL,
    "object_path" text NOT NULL,
    "release_notes" text,
    "is_active" boolean DEFAULT false NOT NULL,
    "uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
];

const FOREIGN_KEYS_SQL = [
  `DO $$ BEGIN
    ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  `DO $$ BEGIN
    ALTER TABLE "wallet_addresses" ADD CONSTRAINT "wallet_addresses_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  `DO $$ BEGIN
    ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  `DO $$ BEGIN
    ALTER TABLE "user_investments" ADD CONSTRAINT "user_investments_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  `DO $$ BEGIN
    ALTER TABLE "user_investments" ADD CONSTRAINT "user_investments_plan_id_investment_plans_id_fk"
      FOREIGN KEY ("plan_id") REFERENCES "investment_plans"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  `DO $$ BEGIN
    ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_users_id_fk"
      FOREIGN KEY ("referrer_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  `DO $$ BEGIN
    ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_id_users_id_fk"
      FOREIGN KEY ("referred_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  `DO $$ BEGIN
    ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  `DO $$ BEGIN
    ALTER TABLE "kyc_submissions" ADD CONSTRAINT "kyc_submissions_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  `DO $$ BEGIN
    ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  `DO $$ BEGIN
    ALTER TABLE "news_posts" ADD CONSTRAINT "news_posts_created_by_users_id_fk"
      FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  `DO $$ BEGIN
    ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  `DO $$ BEGIN
    ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_ticket_id_support_tickets_id_fk"
      FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  `DO $$ BEGIN
    ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  `DO $$ BEGIN
    ALTER TABLE "admin_action_logs" ADD CONSTRAINT "admin_action_logs_admin_id_users_id_fk"
      FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  `DO $$ BEGIN
    ALTER TABLE "admin_action_logs" ADD CONSTRAINT "admin_action_logs_target_user_id_users_id_fk"
      FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
];

const COLUMN_MIGRATIONS_SQL = [
  `ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "tx_id" text`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "transactions_tx_id_unique" ON "transactions"("tx_id") WHERE "tx_id" IS NOT NULL`,
  `ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "referral_pending_earnings" numeric(18, 8) DEFAULT '0' NOT NULL`,
  `ALTER TABLE "app_releases" ADD COLUMN IF NOT EXISTS "uploaded_by" text`,
  `ALTER TABLE "app_releases" ADD COLUMN IF NOT EXISTS "download_count" integer DEFAULT 0 NOT NULL`,
  `ALTER TABLE "investment_plans" ADD COLUMN IF NOT EXISTS "category" text DEFAULT 'General' NOT NULL`,
  `ALTER TABLE "investment_plans" ADD COLUMN IF NOT EXISTS "banner_image_url" text`,
  `ALTER TABLE "investment_plans" ADD COLUMN IF NOT EXISTS "funding_goal" numeric(18, 8)`,
  `ALTER TABLE "investment_plans" ADD COLUMN IF NOT EXISTS "current_funding" numeric(18, 8) DEFAULT '0' NOT NULL`,
  `ALTER TABLE "investment_plans" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'active' NOT NULL`,
  `ALTER TABLE "investment_plans" ADD COLUMN IF NOT EXISTS "color_theme" text DEFAULT 'blue' NOT NULL`,
  `ALTER TABLE "investment_plans" ADD COLUMN IF NOT EXISTS "auto_compound_available" boolean DEFAULT true NOT NULL`,
  `ALTER TABLE "investment_plans" ADD COLUMN IF NOT EXISTS "start_date" timestamp with time zone`,
  `ALTER TABLE "investment_plans" ADD COLUMN IF NOT EXISTS "end_date" timestamp with time zone`,
  `ALTER TABLE "investment_plans" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0 NOT NULL`,
  `ALTER TABLE "investment_plans" ADD COLUMN IF NOT EXISTS "total_participant_limit" integer`,
  `ALTER TABLE "investment_plans" ADD COLUMN IF NOT EXISTS "is_popular" boolean DEFAULT false NOT NULL`,
];

const sslConfig =
  process.env.NODE_ENV === "production"
    ? { ssl: { rejectUnauthorized: false } }
    : {};

export async function runMigrations(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ...sslConfig });

  try {
    for (const sql of TABLES_SQL) {
      await pool.query(sql);
    }
    for (const sql of FOREIGN_KEYS_SQL) {
      await pool.query(sql);
    }
    for (const sql of COLUMN_MIGRATIONS_SQL) {
      await pool.query(sql);
    }
    console.log("[migrate] All tables created / verified ✓");
  } finally {
    await pool.end();
  }
}

export async function backfillTransactionIds(): Promise<void> {
  if (!process.env.DATABASE_URL) return;

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ...sslConfig });
  try {
    const { rows } = await pool.query(
      `SELECT id FROM transactions WHERE tx_id IS NULL ORDER BY id`
    );

    if (rows.length === 0) return;

    const prefixes = ["TX", "VX"];
    for (const row of rows) {
      let updated = false;
      while (!updated) {
        const prefix = prefixes[Math.floor(Math.random() * 2)];
        const digits = Math.floor(100000 + Math.random() * 900000).toString();
        const txId = `${prefix}-${digits}`;
        try {
          await pool.query(
            `UPDATE transactions SET tx_id = $1 WHERE id = $2 AND tx_id IS NULL`,
            [txId, row.id]
          );
          updated = true;
        } catch (e: any) {
          if (e.code !== "23505") throw e;
        }
      }
    }

    console.log(`[backfill] Generated txIds for ${rows.length} transactions ✓`);
  } finally {
    await pool.end();
  }
}
