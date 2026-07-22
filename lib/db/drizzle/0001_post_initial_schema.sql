-- Migration 0001: post-initial schema additions
-- Adds all tables and columns introduced after the baseline migration.
-- Corresponds to COLUMN_MIGRATIONS_SQL and new TABLES_SQL entries in lib/db/src/migrate.ts.

-- ============================================================
-- New columns on existing tables
-- ============================================================

ALTER TABLE "transactions" ADD COLUMN "tx_id" text;
--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_tx_id_unique" ON "transactions" ("tx_id") WHERE "tx_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "wallets" ADD COLUMN "referral_pending_earnings" numeric(18, 8) DEFAULT '0' NOT NULL;
--> statement-breakpoint

-- investment_plans: new columns
ALTER TABLE "investment_plans" ADD COLUMN "category" text DEFAULT 'General' NOT NULL;
--> statement-breakpoint
ALTER TABLE "investment_plans" ADD COLUMN "banner_image_url" text;
--> statement-breakpoint
ALTER TABLE "investment_plans" ADD COLUMN "funding_goal" numeric(18, 8);
--> statement-breakpoint
ALTER TABLE "investment_plans" ADD COLUMN "current_funding" numeric(18, 8) DEFAULT '0' NOT NULL;
--> statement-breakpoint
ALTER TABLE "investment_plans" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;
--> statement-breakpoint
ALTER TABLE "investment_plans" ADD COLUMN "color_theme" text DEFAULT 'blue' NOT NULL;
--> statement-breakpoint
ALTER TABLE "investment_plans" ADD COLUMN "auto_compound_available" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "investment_plans" ADD COLUMN "start_date" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "investment_plans" ADD COLUMN "end_date" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "investment_plans" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "investment_plans" ADD COLUMN "total_participant_limit" integer;
--> statement-breakpoint
ALTER TABLE "investment_plans" ADD COLUMN "is_popular" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "investment_plans" ADD COLUMN "display_participant_count" integer;
--> statement-breakpoint

-- investment_plans: correct ROI rate defaults (were 0.025/0.030 in baseline)
ALTER TABLE "investment_plans" ALTER COLUMN "min_roi_rate" SET DEFAULT '0.013';
--> statement-breakpoint
ALTER TABLE "investment_plans" ALTER COLUMN "max_roi_rate" SET DEFAULT '0.017';
--> statement-breakpoint

-- referrals: new column
ALTER TABLE "referrals" ADD COLUMN "referral_source" text DEFAULT 'direct';
--> statement-breakpoint

-- users: security and email-verification columns
ALTER TABLE "users" ADD COLUMN "withdrawal_password_hash" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verification_code" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verification_expires" timestamp with time zone;
--> statement-breakpoint

-- ============================================================
-- New tables
-- ============================================================

CREATE TABLE "admin_action_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" integer NOT NULL,
	"target_user_id" integer NOT NULL,
	"action" text NOT NULL,
	"details" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Note: uploaded_at intentionally uses bare "timestamp" here to match the
-- 0001_snapshot.json baseline; migration 0002 corrects it to "timestamp with time zone".
CREATE TABLE "app_releases" (
	"id" serial PRIMARY KEY NOT NULL,
	"version" text NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer NOT NULL,
	"object_path" text NOT NULL,
	"release_notes" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"uploaded_by" text,
	"download_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint

CREATE TABLE "withdrawal_addresses" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"network" text NOT NULL,
	"address" text NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "faqs" (
	"id" serial PRIMARY KEY NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"category" text DEFAULT 'General' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Note: description is nullable here to match the 0001_snapshot.json baseline;
-- migration 0002 sets it NOT NULL.
CREATE TABLE "community_channels" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'chat' NOT NULL,
	"description" text DEFAULT '',
	"is_locked" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "community_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"image_url" text,
	"reply_to_id" integer,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_by" integer,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"is_system_message" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "community_reactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "community_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer NOT NULL,
	"reporter_id" integer NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "community_pinned_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel_id" integer NOT NULL,
	"message_id" integer NOT NULL,
	"pinned_by" integer NOT NULL,
	"pinned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "community_bans" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"banned_by" integer NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "community_mutes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"muted_by" integer NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"expires_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "community_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"message_id" integer,
	"channel_id" integer,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "community_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"community_role" text DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "community_members_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint

CREATE TABLE "referral_salary" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"current_volume" numeric(18, 8) DEFAULT '0' NOT NULL,
	"current_tier" integer,
	"monthly_salary" numeric(18, 8) DEFAULT '0' NOT NULL,
	"next_payment_date" timestamp with time zone,
	"total_salary_paid" numeric(18, 8) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_calculated_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referral_salary_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint

CREATE TABLE "announcements" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"show_to_new_users" boolean DEFAULT true NOT NULL,
	"show_to_existing_users" boolean DEFAULT true NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"scheduled_at" timestamp with time zone,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "announcement_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"announcement_id" integer NOT NULL,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- ============================================================
-- Foreign keys for new tables
-- ============================================================

ALTER TABLE "admin_action_logs" ADD CONSTRAINT "admin_action_logs_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "admin_action_logs" ADD CONSTRAINT "admin_action_logs_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "community_messages" ADD CONSTRAINT "community_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "community_reactions" ADD CONSTRAINT "community_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "community_reports" ADD CONSTRAINT "community_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "community_pinned_posts" ADD CONSTRAINT "community_pinned_posts_pinned_by_users_id_fk" FOREIGN KEY ("pinned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "community_bans" ADD CONSTRAINT "community_bans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "community_bans" ADD CONSTRAINT "community_bans_banned_by_users_id_fk" FOREIGN KEY ("banned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "community_mutes" ADD CONSTRAINT "community_mutes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "community_mutes" ADD CONSTRAINT "community_mutes_muted_by_users_id_fk" FOREIGN KEY ("muted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "community_notifications" ADD CONSTRAINT "community_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "community_members" ADD CONSTRAINT "community_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "referral_salary" ADD CONSTRAINT "referral_salary_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "announcement_views" ADD CONSTRAINT "announcement_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "announcement_views" ADD CONSTRAINT "announcement_views_announcement_id_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcements"("id") ON DELETE no action ON UPDATE no action;
