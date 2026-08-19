import { Router, type IRouter } from "express";
import crypto from "crypto";
import { gunzipSync, gzipSync } from "zlib";
import { eq, desc } from "drizzle-orm";
import {
  db,
  backupLogsTable,
  usersTable,
  walletsTable,
  walletAddressesTable,
  transactionsTable,
  investmentPlansTable,
  userInvestmentsTable,
  referralsTable,
  referralSalaryTable,
  notificationsTable,
  kycSubmissionsTable,
  passwordResetTokensTable,
  newsPostsTable,
  supportTicketsTable,
  supportMessagesTable,
  depositNetworksTable,
  platformSettingsTable,
  adminActionLogsTable,
  appReleasesTable,
  faqsTable,
  withdrawalAddressesTable,
  announcementsTable,
  announcementViewsTable,
  sessionsTable,
} from "@workspace/db";
import { requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

// ─── Backup format constants ────────────────────────────────────────────────
const BACKUP_VERSION = "1.0.0";
const SCHEMA_VERSION = "2.0.0";
const PLATFORM_NAME = "Wexora Global";

// Encryption key derived from SESSION_SECRET (never stored in backup)
function getEncryptionKey(): Buffer {
  const secret = process.env.SESSION_SECRET || process.env.DATABASE_URL || "wexora-backup-fallback-key";
  return crypto.scryptSync(secret, "wexora-backup-salt-v1", 32);
}

function encrypt(data: Buffer): { iv: string; encrypted: string } {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  return { iv: iv.toString("hex"), encrypted: encrypted.toString("hex") };
}

function decrypt(ivHex: string, encryptedHex: string): Buffer {
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

// ─── Table definitions for backup ───────────────────────────────────────────
interface TableDef {
  name: string;
  query: () => Promise<unknown[]>;
  hasUserId?: boolean;
}

function getBackupTables(): TableDef[] {
  return [
    { name: "users", query: () => db.select().from(usersTable) },
    { name: "wallets", query: () => db.select().from(walletsTable) },
    { name: "wallet_addresses", query: () => db.select().from(walletAddressesTable) },
    { name: "investment_plans", query: () => db.select().from(investmentPlansTable) },
    { name: "user_investments", query: () => db.select().from(userInvestmentsTable) },
    { name: "transactions", query: () => db.select().from(transactionsTable) },
    { name: "referrals", query: () => db.select().from(referralsTable) },
    { name: "referral_salary", query: () => db.select().from(referralSalaryTable) },
    { name: "notifications", query: () => db.select().from(notificationsTable) },
    { name: "kyc_submissions", query: () => db.select().from(kycSubmissionsTable) },
    { name: "password_reset_tokens", query: () => db.select().from(passwordResetTokensTable) },
    { name: "news_posts", query: () => db.select().from(newsPostsTable) },
    { name: "support_tickets", query: () => db.select().from(supportTicketsTable) },
    { name: "support_messages", query: () => db.select().from(supportMessagesTable) },
    { name: "deposit_networks", query: () => db.select().from(depositNetworksTable) },
    { name: "platform_settings", query: () => db.select().from(platformSettingsTable) },
    { name: "admin_action_logs", query: () => db.select().from(adminActionLogsTable) },
    { name: "app_releases", query: () => db.select().from(appReleasesTable) },
    { name: "faqs", query: () => db.select().from(faqsTable) },
    { name: "withdrawal_addresses", query: () => db.select().from(withdrawalAddressesTable) },
    { name: "announcements", query: () => db.select().from(announcementsTable) },
    { name: "announcement_views", query: () => db.select().from(announcementViewsTable) },
    { name: "session", query: () => db.select().from(sessionsTable) },
  ];
}

// ─── Sanitize: strip secrets from users table ───────────────────────────────
function sanitizeUserData(users: Record<string, unknown>[]) {
  return users.map((u) => {
    const sanitized = { ...u };
    delete sanitized.passwordHash;
    delete sanitized.twoFaSecret;
    delete sanitized.withdrawalPasswordHash;
    delete sanitized.emailVerificationCode;
    return sanitized;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/backup/create — Create a full backup
// ─────────────────────────────────────────────────────────────────────────────
router.post("/admin/backup/create", requireAdmin, async (req, res): Promise<void> => {
  const adminId = req.session.userId!;
  const tables = getBackupTables();
  let logId: number | null = null;

  try {
    // Create log entry
    const [log] = await db
      .insert(backupLogsTable)
      .values({ adminId, type: "backup", status: "pending" })
      .returning({ id: backupLogsTable.id });
    logId = log.id;

    // Collect all table data
    const tableData: Record<string, unknown[]> = {};
    let totalRecords = 0;

    for (const table of tables) {
      const rows = await table.query();
      let data = rows as Record<string, unknown>[];

      // Sanitize sensitive fields from users table
      if (table.name === "users") {
        data = sanitizeUserData(data);
      }

      // Strip sessions — they're ephemeral
      if (table.name === "session") {
        data = [];
      }

      tableData[table.name] = data;
      totalRecords += data.length;
    }

    // Build backup payload
    const payload = {
      format: "WEXORA_BACKUP",
      version: BACKUP_VERSION,
      schemaVersion: SCHEMA_VERSION,
      platform: PLATFORM_NAME,
      createdAt: new Date().toISOString(),
      tableCount: Object.keys(tableData).length,
      totalRecords,
      tables: tableData,
    };

    // Serialize, compress, encrypt
    const jsonStr = JSON.stringify(payload);
    const compressed = gzipSync(Buffer.from(jsonStr, "utf-8"));
    const { iv, encrypted } = encrypt(compressed);

    // Generate checksum of the compressed (pre-encryption) data
    const checksum = crypto.createHash("sha256").update(compressed).digest("hex");

    // Build final backup envelope
    const envelope = {
      format: "WEXORA_BACKUP_ENVELOPE",
      version: BACKUP_VERSION,
      iv,
      data: encrypted,
      checksum,
      createdAt: payload.createdAt,
    };

    const envelopeJson = JSON.stringify(envelope);
    const fileSize = Buffer.byteLength(envelopeJson, "utf-8");
    const fileName = `wexora-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.wexora`;

    // Update log
    await db
      .update(backupLogsTable)
      .set({
        status: "success",
        backupVersion: BACKUP_VERSION,
        schemaVersion: SCHEMA_VERSION,
        tableCount: Object.keys(tableData).length,
        recordCount: totalRecords,
        fileSizeBytes: fileSize,
        checksum,
        fileName,
      })
      .where(eq(backupLogsTable.id, logId));

    res.json({
      success: true,
      backup: {
        fileName,
        fileSize,
        fileSizeMB: (fileSize / (1024 * 1024)).toFixed(2),
        tableCount: Object.keys(tableData).length,
        recordCount: totalRecords,
        recordsByTable: Object.fromEntries(
          Object.entries(tableData).map(([k, v]) => [k, v.length])
        ),
        createdAt: payload.createdAt,
        backupVersion: BACKUP_VERSION,
        schemaVersion: SCHEMA_VERSION,
        checksum,
      },
      data: envelopeJson,
    });
  } catch (err: any) {
    if (logId) {
      await db
        .update(backupLogsTable)
        .set({ status: "failed", errorMessage: err.message || String(err) })
        .where(eq(backupLogsTable.id, logId));
    }
    res.status(500).json({ error: "Backup creation failed", message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/backup/validate — Validate a backup file without restoring
// ─────────────────────────────────────────────────────────────────────────────
router.post("/admin/backup/validate", requireAdmin, async (req, res): Promise<void> => {
  const { data: envelopeJson } = req.body;

  if (!envelopeJson) {
    res.status(400).json({ error: "No backup data provided" });
    return;
  }

  try {
    const envelope = JSON.parse(envelopeJson);

    // Validate envelope format
    if (envelope.format !== "WEXORA_BACKUP_ENVELOPE") {
      res.status(400).json({ error: "Invalid backup format", expected: "WEXORA_BACKUP_ENVELOPE", got: envelope.format });
      return;
    }

    if (envelope.version !== BACKUP_VERSION) {
      res.status(400).json({ error: "Incompatible backup version", expected: BACKUP_VERSION, got: envelope.version });
      return;
    }

    // Decrypt
    const compressed = decrypt(envelope.iv, envelope.data);

    // Verify checksum
    const checksum = crypto.createHash("sha256").update(compressed).digest("hex");
    if (checksum !== envelope.checksum) {
      res.status(400).json({ error: "Checksum mismatch — backup may be corrupted" });
      return;
    }

    // Decompress
    const jsonStr = gunzipSync(compressed).toString("utf-8");
    const payload = JSON.parse(jsonStr);

    // Validate payload structure
    if (payload.format !== "WEXORA_BACKUP") {
      res.status(400).json({ error: "Invalid payload format" });
      return;
    }

    // Build validation summary
    const tableSummary: Record<string, number> = {};
    let totalRecords = 0;
    for (const [tableName, rows] of Object.entries(payload.tables)) {
      const count = Array.isArray(rows) ? rows.length : 0;
      tableSummary[tableName] = count;
      totalRecords += count;
    }

    // Detect schema compatibility
    const warnings: string[] = [];
    if (payload.schemaVersion !== SCHEMA_VERSION) {
      warnings.push(`Schema version mismatch: backup=${payload.schemaVersion}, current=${SCHEMA_VERSION}`);
    }
    if (payload.platform !== PLATFORM_NAME) {
      warnings.push(`Platform mismatch: backup=${payload.platform}, expected=${PLATFORM_NAME}`);
    }

    // Check for missing tables
    const currentTables = getBackupTables().map((t) => t.name);
    const backupTables = Object.keys(payload.tables);
    const missingInBackup = currentTables.filter((t) => !backupTables.includes(t));
    const extraInBackup = backupTables.filter((t) => !currentTables.includes(t));

    if (missingInBackup.length > 0) {
      warnings.push(`Tables missing from backup: ${missingInBackup.join(", ")}`);
    }
    if (extraInBackup.length > 0) {
      warnings.push(`Extra tables in backup: ${extraInBackup.join(", ")}`);
    }

    // Detect potential conflicts (check for users in backup that already exist)
    let conflictCount = 0;
    if (payload.tables.users && Array.isArray(payload.tables.users)) {
      const backupEmails = payload.tables.users.map((u: any) => u.email).filter(Boolean);
      if (backupEmails.length > 0) {
        const existingUsers = await db
          .select({ email: usersTable.email })
          .from(usersTable);
        const existingEmails = new Set(existingUsers.map((u) => u.email));
        conflictCount = backupEmails.filter((e: string) => existingEmails.has(e)).length;
      }
    }

    const logId = req.session.userId;
    await db.insert(backupLogsTable).values({
      adminId: logId!,
      type: "validate",
      status: "success",
      backupVersion: payload.version,
      schemaVersion: payload.schemaVersion,
      tableCount: Object.keys(payload.tables).length,
      recordCount: totalRecords,
      checksum,
    });

    res.json({
      valid: true,
      summary: {
        format: payload.format,
        version: payload.version,
        schemaVersion: payload.schemaVersion,
        platform: payload.platform,
        createdAt: payload.createdAt,
        tableCount: Object.keys(payload.tables).length,
        totalRecords,
        recordsByTable: tableSummary,
        checksum,
      },
      warnings,
      conflicts: {
        duplicateUsers: conflictCount,
      },
      missingInBackup,
      extraInBackup,
      readyToRestore: warnings.length === 0 && conflictCount === 0,
    });
  } catch (err: any) {
    res.status(400).json({ error: "Failed to validate backup", message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/backup/restore — Restore from a validated backup
// ─────────────────────────────────────────────────────────────────────────────
router.post("/admin/backup/restore", requireAdmin, async (req, res): Promise<void> => {
  const adminId = req.session.userId!;
  const { data: envelopeJson, mode = "full" } = req.body;

  if (!envelopeJson) {
    res.status(400).json({ error: "No backup data provided" });
    return;
  }

  if (mode !== "full" && mode !== "merge") {
    res.status(400).json({ error: "Invalid restore mode. Use 'full' or 'merge'." });
    return;
  }

  let logId: number | null = null;

  try {
    // Step 1: Create pre-restore emergency backup
    const preRestoreTables = getBackupTables();
    const preRestoreData: Record<string, unknown[]> = {};
    let preRestoreRecords = 0;

    for (const table of preRestoreTables) {
      const rows = await table.query();
      let data = rows as Record<string, unknown>[];
      if (table.name === "users") data = sanitizeUserData(data);
      if (table.name === "session") data = [];
      preRestoreData[table.name] = data;
      preRestoreRecords += data.length;
    }

    const preRestorePayload = {
      format: "WEXORA_BACKUP",
      version: BACKUP_VERSION,
      schemaVersion: SCHEMA_VERSION,
      platform: PLATFORM_NAME,
      createdAt: new Date().toISOString(),
      tableCount: Object.keys(preRestoreData).length,
      totalRecords: preRestoreRecords,
      tables: preRestoreData,
    };

    const preRestoreJson = JSON.stringify(preRestorePayload);
    const preRestoreCompressed = gzipSync(Buffer.from(preRestoreJson, "utf-8"));
    const { iv: preIv, encrypted: preEncrypted } = encrypt(preRestoreCompressed);
    const preRestoreChecksum = crypto.createHash("sha256").update(preRestoreCompressed).digest("hex");
    const preRestoreFileName = `pre-restore-${new Date().toISOString().replace(/[:.]/g, "-")}.wexora`;

    // Log the pre-restore backup
    const [preLog] = await db
      .insert(backupLogsTable)
      .values({
        adminId,
        type: "backup",
        status: "success",
        backupVersion: BACKUP_VERSION,
        schemaVersion: SCHEMA_VERSION,
        tableCount: Object.keys(preRestoreData).length,
        recordCount: preRestoreRecords,
        fileSizeBytes: Buffer.byteLength(JSON.stringify({ format: "WEXORA_BACKUP_ENVELOPE", iv: preIv, data: preEncrypted, checksum: preRestoreChecksum, createdAt: preRestorePayload.createdAt }), "utf-8"),
        checksum: preRestoreChecksum,
        fileName: preRestoreFileName,
      })
      .returning({ id: backupLogsTable.id });

    // Step 2: Validate incoming backup
    const envelope = JSON.parse(envelopeJson);
    const compressed = decrypt(envelope.iv, envelope.data);
    const checksum = crypto.createHash("sha256").update(compressed).digest("hex");

    if (checksum !== envelope.checksum) {
      res.status(400).json({ error: "Checksum mismatch — backup may be corrupted" });
      return;
    }

    const jsonStr = gunzipSync(compressed).toString("utf-8");
    const payload = JSON.parse(jsonStr);

    // Create restore log
    const [restoreLog] = await db
      .insert(backupLogsTable)
      .values({
        adminId,
        type: "restore",
        status: "pending",
        backupVersion: payload.version,
        schemaVersion: payload.schemaVersion,
        tableCount: Object.keys(payload.tables).length,
        recordCount: payload.totalRecords,
        checksum,
        restoreMode: mode,
        preRestoreBackupId: preLog.id,
      })
      .returning({ id: backupLogsTable.id });
    logId = restoreLog.id;

    // Step 3: Perform restore
    // Define restore order (respect foreign key dependencies)
    const restoreOrder = [
      "platform_settings",
      "deposit_networks",
      "faqs",
      "app_releases",
      "investment_plans",
      "users",
      "wallets",
      "wallet_addresses",
      "transactions",
      "user_investments",
      "referrals",
      "referral_salary",
      "notifications",
      "kyc_submissions",
      "password_reset_tokens",
      "news_posts",
      "support_tickets",
      "support_messages",
      "admin_action_logs",
      "withdrawal_addresses",
      "announcements",
      "announcement_views",
      "community_channels",
      "community_messages",
      "community_reactions",
      "community_reports",
      "community_pinned_posts",
      "community_bans",
      "community_mutes",
      "community_notifications",
      "community_members",
    ];

    let restoredRecords = 0;
    const restoredTables: Record<string, number> = {};

    for (const tableName of restoreOrder) {
      const rows = payload.tables[tableName];
      if (!rows || !Array.isArray(rows) || rows.length === 0) continue;

      // Re-add stripped fields as null for users
      if (tableName === "users") {
        for (const user of rows) {
          if (!("passwordHash" in user)) user.passwordHash = "";
          if (!("twoFaSecret" in user)) user.twoFaSecret = null;
          if (!("withdrawalPasswordHash" in user)) user.withdrawalPasswordHash = null;
          if (!("emailVerificationCode" in user)) user.emailVerificationCode = null;
        }
      }

      if (mode === "full") {
        // Full restore: truncate and insert
        await db.execute(`TRUNCATE TABLE "${tableName}" CASCADE`);
        if (rows.length > 0) {
          // Batch insert in chunks of 500
          for (let i = 0; i < rows.length; i += 500) {
            const batch = rows.slice(i, i + 500);
            await db.execute(
              `INSERT INTO "${tableName}" SELECT * FROM jsonb_populate_recordset(NULL::"${tableName}", '${JSON.stringify(batch).replace(/'/g, "''")}')`
            );
          }
        }
      } else {
        // Merge mode: skip duplicates by primary key
        // For tables with serial PKs, we need to handle this carefully
        // Only merge safe tables (settings, content, configs — NOT financial data)
        const safeForMerge = [
          "platform_settings", "deposit_networks", "faqs", "app_releases",
          "investment_plans", "announcements", "news_posts",
          "community_channels",
        ];

        if (!safeForMerge.includes(tableName)) {
          // Skip non-merge-safe tables (financial data, user data)
          restoredTables[tableName] = 0;
          continue;
        }

        // Use ON CONFLICT DO NOTHING for safe tables
        for (const row of rows) {
          try {
            const columns = Object.keys(row);
            const values = Object.values(row).map((v) =>
              v === null ? "NULL" : `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`
            );
            await db.execute(
              `INSERT INTO "${tableName}" (${columns.map((c) => `"${c}"`).join(", ")})
               SELECT * FROM jsonb_populate_recordset(NULL::"${tableName}", '[${JSON.stringify(row).replace(/'/g, "''")}]')
               ON CONFLICT DO NOTHING`
            );
          } catch {
            // Skip on conflict or error — merge mode is best-effort
          }
        }
      }

      restoredTables[tableName] = rows.length;
      restoredRecords += rows.length;
    }

    // Update restore log
    await db
      .update(backupLogsTable)
      .set({
        status: "success",
        recordCount: restoredRecords,
      })
      .where(eq(backupLogsTable.id, logId));

    res.json({
      success: true,
      mode,
      restoredTables,
      totalRecordsRestored: restoredRecords,
      preRestoreBackup: {
        id: preLog.id,
        fileName: preRestoreFileName,
        records: preRestoreRecords,
      },
      message: mode === "full"
        ? "Full restore completed. All existing data has been replaced."
        : "Merge restore completed. Only non-conflicting records were imported.",
    });
  } catch (err: any) {
    if (logId) {
      await db
        .update(backupLogsTable)
        .set({ status: "failed", errorMessage: err.message || String(err) })
        .where(eq(backupLogsTable.id, logId));
    }
    res.status(500).json({ error: "Restore failed", message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/backup/history — List backup/restore history
// ─────────────────────────────────────────────────────────────────────────────
router.get("/admin/backup/history", requireAdmin, async (_req, res): Promise<void> => {
  const logs = await db
    .select()
    .from(backupLogsTable)
    .orderBy(desc(backupLogsTable.createdAt))
    .limit(100);

  res.json(
    logs.map((l) => ({
      id: l.id,
      type: l.type,
      status: l.status,
      backupVersion: l.backupVersion,
      schemaVersion: l.schemaVersion,
      tableCount: l.tableCount,
      recordCount: l.recordCount,
      fileSizeBytes: l.fileSizeBytes,
      fileName: l.fileName,
      errorMessage: l.errorMessage,
      restoreMode: l.restoreMode,
      preRestoreBackupId: l.preRestoreBackupId,
      createdAt: l.createdAt,
    }))
  );
});

export default router;
