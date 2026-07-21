import { Router, type IRouter } from "express";
import { db, platformSettingsTable, notificationsTable, usersTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

const MIRROR_KEYS = ["github", "mediafire", "gdrive", "telegram", "primary", "mirror", "backup"];

const APP_SETTINGS_KEYS = [
  "app_name",
  "app_version",
  "apk_size",
  "app_last_updated",
  "release_notes",
  "changelog",
  "force_update_enabled",
  "github_download_url",
  "mediafire_download_url",
  "gdrive_download_url",
  "telegram_download_url",
  "primary_download_url",
  "mirror_download_url",
  "backup_download_url",
  "github_download_count",
  "mediafire_download_count",
  "gdrive_download_count",
  "telegram_download_count",
  "primary_download_count",
  "mirror_download_count",
  "backup_download_count",
];

async function getAppSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(platformSettingsTable).where(inArray(platformSettingsTable.key, APP_SETTINGS_KEYS));
  const obj: Record<string, string> = {};
  for (const r of rows) obj[r.key] = r.value;
  return obj;
}

// ─── Public: get app info ──────────────────────────────────────────────────
router.get("/app-info", async (_req, res): Promise<void> => {
  try {
    const s = await getAppSettings();
    res.json({
      appName:             s.app_name || "Wexora",
      version:             s.app_version || "",
      size:                s.apk_size || "",
      lastUpdated:         s.app_last_updated || "",
      releaseNotes:        s.release_notes || "",
      changelog:           s.changelog || "",
      forceUpdateEnabled:  s.force_update_enabled === "true",
      githubUrl:           s.github_download_url || "",
      mediafireUrl:   s.mediafire_download_url || "",
      gdriveUrl:      s.gdrive_download_url || "",
      telegramUrl:    s.telegram_download_url || "",
      primaryUrl:     s.primary_download_url || "",
      mirrorUrl:      s.mirror_download_url || "",
      backupUrl:      s.backup_download_url || "",
      githubCount:    parseInt(s.github_download_count || "0", 10),
      mediafireCount: parseInt(s.mediafire_download_count || "0", 10),
      gdriveCount:    parseInt(s.gdrive_download_count || "0", 10),
      telegramCount:  parseInt(s.telegram_download_count || "0", 10),
      primaryCount:   parseInt(s.primary_download_count || "0", 10),
      mirrorCount:    parseInt(s.mirror_download_count || "0", 10),
      backupCount:    parseInt(s.backup_download_count || "0", 10),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Failed to load app info" });
  }
});

// ─── Track download click (public) ────────────────────────────────────────
router.post("/app-info/download/:server", async (req, res): Promise<void> => {
  const server = String(req.params['server']);
  if (!MIRROR_KEYS.includes(server)) {
    res.status(400).json({ error: "Invalid server name" });
    return;
  }
  const key = `${server}_download_count`;
  try {
    const existing = await db.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, key)).limit(1);
    const next = parseInt(existing[0]?.value || "0", 10) + 1;
    await db.insert(platformSettingsTable).values({ key, value: String(next) }).onConflictDoUpdate({
      target: platformSettingsTable.key,
      set: { value: String(next), updatedAt: new Date() },
    });
    res.json({ success: true, count: next });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Failed to record download" });
  }
});

// ─── Admin: get app settings ───────────────────────────────────────────────
router.get("/admin/app-settings", requireAdmin, async (_req, res): Promise<void> => {
  try {
    res.json(await getAppSettings());
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Failed to load app settings" });
  }
});

// ─── Admin: update app settings ───────────────────────────────────────────
router.put("/admin/app-settings", requireAdmin, async (req, res): Promise<void> => {
  const EDITABLE_KEYS = [
    "app_name", "app_version", "apk_size", "app_last_updated", "release_notes", "changelog",
    "force_update_enabled",
    "github_download_url", "mediafire_download_url", "gdrive_download_url", "telegram_download_url",
    "primary_download_url", "mirror_download_url", "backup_download_url",
  ];
  const updates = req.body as Record<string, string>;
  try {
    for (const key of EDITABLE_KEYS) {
      if (key in updates) {
        await db.insert(platformSettingsTable).values({ key, value: String(updates[key] ?? "") }).onConflictDoUpdate({
          target: platformSettingsTable.key,
          set: { value: String(updates[key] ?? ""), updatedAt: new Date() },
        });
      }
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Failed to save app settings" });
  }
});

// ─── Admin: reset download counter ────────────────────────────────────────
router.post("/admin/app-settings/reset-counter/:server", requireAdmin, async (req, res): Promise<void> => {
  const server = String(req.params['server']);
  if (!MIRROR_KEYS.includes(server)) {
    res.status(400).json({ error: "Invalid server name" });
    return;
  }
  const key = `${server}_download_count`;
  try {
    await db.insert(platformSettingsTable).values({ key, value: "0" }).onConflictDoUpdate({
      target: platformSettingsTable.key,
      set: { value: "0", updatedAt: new Date() },
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Failed to reset counter" });
  }
});

// ─── Admin: broadcast update notification to all users ─────────────────────
router.post("/admin/app-settings/notify-update", requireAdmin, async (req, res): Promise<void> => {
  try {
    const s = await getAppSettings();
    const version = s.app_version?.trim();

    if (!version) {
      res.status(400).json({ error: "No app version configured. Set a version before sending notifications." });
      return;
    }

    const users = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.isActive, true));

    if (users.length === 0) {
      res.json({ success: true, sentTo: 0 });
      return;
    }

    const title = `🔔 New App Update Available`;
    const message = `Wexora v${version} is now available. Tap to download the latest version.`;

    const values = users.map((u) => ({
      userId: u.id,
      type: "announcement",
      title,
      message,
      isBroadcast: true,
    }));

    for (let i = 0; i < values.length; i += 100) {
      await db.insert(notificationsTable).values(values.slice(i, i + 100));
    }

    res.json({ success: true, sentTo: users.length, version });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Failed to send notifications" });
  }
});

export default router;
