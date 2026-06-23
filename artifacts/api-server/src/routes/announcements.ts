import { Router, type IRouter } from "express";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import {
  db,
  announcementsTable,
  announcementViewsTable,
  usersTable,
  platformSettingsTable,
  adminActionLogsTable,
} from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ── Helpers ────────────────────────────────────────────────────────────────────

function serializeAnnouncement(a: typeof announcementsTable.$inferSelect) {
  return {
    id: a.id,
    title: a.title,
    content: a.content,
    isActive: a.isActive,
    priority: a.priority,
    showToNewUsers: a.showToNewUsers,
    showToExistingUsers: a.showToExistingUsers,
    isPinned: a.isPinned,
    scheduledAt: a.scheduledAt,
    createdBy: a.createdBy,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

async function getSetting(key: string, fallback: string): Promise<string> {
  try {
    const [row] = await db
      .select()
      .from(platformSettingsTable)
      .where(eq(platformSettingsTable.key, key))
      .limit(1);
    return row?.value ?? fallback;
  } catch {
    return fallback;
  }
}

// ── Admin: List all announcements ──────────────────────────────────────────────
router.get("/admin/announcements", requireAdmin, async (req, res): Promise<void> => {
  try {
    const rows = await db
      .select()
      .from(announcementsTable)
      .orderBy(desc(announcementsTable.isPinned), desc(announcementsTable.priority), desc(announcementsTable.createdAt));
    res.json(rows.map(serializeAnnouncement));
  } catch (err: any) {
    logger.error({ err }, "announcements list error");
    res.status(500).json({ success: false, message: err?.message ?? "Failed to load announcements" });
  }
});

// ── Admin: Create announcement ─────────────────────────────────────────────────
router.post("/admin/announcements", requireAdmin, async (req, res): Promise<void> => {
  logger.info({ body: req.body }, "announcement create: incoming payload");

  try {
    const {
      title, content, isActive = false, priority = 0,
      showToNewUsers = true, showToExistingUsers = true,
      isPinned = false, scheduledAt,
    } = req.body;

    if (!title?.trim()) {
      res.status(400).json({ success: false, message: "Title is required" });
      return;
    }
    if (!content?.trim()) {
      res.status(400).json({ success: false, message: "Content is required" });
      return;
    }

    const [row] = await db.insert(announcementsTable).values({
      title: title.trim(),
      content: content.trim(),
      isActive: Boolean(isActive),
      priority: parseInt(String(priority), 10) || 0,
      showToNewUsers: Boolean(showToNewUsers),
      showToExistingUsers: Boolean(showToExistingUsers),
      isPinned: Boolean(isPinned),
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      createdBy: req.session.userId!,
    }).returning();

    logger.info({ id: row.id, title: row.title }, "announcement created");

    // Audit log — non-fatal if it fails
    try {
      await db.insert(adminActionLogsTable).values({
        adminId: req.session.userId!,
        targetUserId: req.session.userId!,
        action: "announcement_created",
        details: `Created announcement: "${title.trim()}"`,
      });
    } catch (auditErr) {
      logger.warn({ auditErr }, "audit log insert failed (non-fatal)");
    }

    res.status(201).json(serializeAnnouncement(row));
  } catch (err: any) {
    logger.error({ err, body: req.body }, "announcement create error");
    res.status(500).json({ success: false, message: err?.message ?? "Failed to create announcement" });
  }
});

// ── Admin: Update announcement ─────────────────────────────────────────────────
router.put("/admin/announcements/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  logger.info({ id, body: req.body }, "announcement update: incoming payload");

  try {
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: "Invalid announcement ID" });
      return;
    }

    const {
      title, content, isActive, priority,
      showToNewUsers, showToExistingUsers, isPinned, scheduledAt,
    } = req.body;

    const existing = await db.select().from(announcementsTable).where(eq(announcementsTable.id, id)).limit(1);
    if (!existing.length) {
      res.status(404).json({ success: false, message: "Announcement not found" });
      return;
    }

    const updates: Partial<typeof announcementsTable.$inferInsert> = {};
    if (title !== undefined) updates.title = String(title).trim();
    if (content !== undefined) updates.content = String(content).trim();
    if (isActive !== undefined) updates.isActive = Boolean(isActive);
    if (priority !== undefined) updates.priority = parseInt(String(priority), 10) || 0;
    if (showToNewUsers !== undefined) updates.showToNewUsers = Boolean(showToNewUsers);
    if (showToExistingUsers !== undefined) updates.showToExistingUsers = Boolean(showToExistingUsers);
    if (isPinned !== undefined) updates.isPinned = Boolean(isPinned);
    if (scheduledAt !== undefined) updates.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;

    const [row] = await db.update(announcementsTable).set(updates).where(eq(announcementsTable.id, id)).returning();

    logger.info({ id: row.id }, "announcement updated");

    try {
      await db.insert(adminActionLogsTable).values({
        adminId: req.session.userId!,
        targetUserId: req.session.userId!,
        action: "announcement_updated",
        details: `Updated announcement #${id}: "${row.title}"`,
      });
    } catch (auditErr) {
      logger.warn({ auditErr }, "audit log insert failed (non-fatal)");
    }

    res.json(serializeAnnouncement(row));
  } catch (err: any) {
    logger.error({ err, id }, "announcement update error");
    res.status(500).json({ success: false, message: err?.message ?? "Failed to update announcement" });
  }
});

// ── Admin: Delete announcement ─────────────────────────────────────────────────
router.delete("/admin/announcements/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);

  try {
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: "Invalid announcement ID" });
      return;
    }

    const existing = await db.select().from(announcementsTable).where(eq(announcementsTable.id, id)).limit(1);
    if (!existing.length) {
      res.status(404).json({ success: false, message: "Announcement not found" });
      return;
    }

    await db.delete(announcementViewsTable).where(eq(announcementViewsTable.announcementId, id));
    await db.delete(announcementsTable).where(eq(announcementsTable.id, id));

    logger.info({ id }, "announcement deleted");

    try {
      await db.insert(adminActionLogsTable).values({
        adminId: req.session.userId!,
        targetUserId: req.session.userId!,
        action: "announcement_deleted",
        details: `Deleted announcement #${id}: "${existing[0].title}"`,
      });
    } catch (auditErr) {
      logger.warn({ auditErr }, "audit log insert failed (non-fatal)");
    }

    res.json({ success: true });
  } catch (err: any) {
    logger.error({ err, id }, "announcement delete error");
    res.status(500).json({ success: false, message: err?.message ?? "Failed to delete announcement" });
  }
});

// ── Admin: Toggle active ───────────────────────────────────────────────────────
router.patch("/admin/announcements/:id/toggle", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);

  try {
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: "Invalid announcement ID" });
      return;
    }

    const [existing] = await db.select().from(announcementsTable).where(eq(announcementsTable.id, id)).limit(1);
    if (!existing) {
      res.status(404).json({ success: false, message: "Announcement not found" });
      return;
    }

    const [row] = await db
      .update(announcementsTable)
      .set({ isActive: !existing.isActive })
      .where(eq(announcementsTable.id, id))
      .returning();

    logger.info({ id, isActive: row.isActive }, "announcement toggled");
    res.json(serializeAnnouncement(row));
  } catch (err: any) {
    logger.error({ err, id }, "announcement toggle error");
    res.status(500).json({ success: false, message: err?.message ?? "Failed to toggle announcement" });
  }
});

// ── Admin: Pin / Unpin announcement ───────────────────────────────────────────
router.patch("/admin/announcements/:id/pin", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);

  try {
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: "Invalid announcement ID" });
      return;
    }

    const [existing] = await db.select().from(announcementsTable).where(eq(announcementsTable.id, id)).limit(1);
    if (!existing) {
      res.status(404).json({ success: false, message: "Announcement not found" });
      return;
    }

    const [row] = await db
      .update(announcementsTable)
      .set({ isPinned: !existing.isPinned })
      .where(eq(announcementsTable.id, id))
      .returning();

    logger.info({ id, isPinned: row.isPinned }, "announcement pin toggled");
    res.json(serializeAnnouncement(row));
  } catch (err: any) {
    logger.error({ err, id }, "announcement pin error");
    res.status(500).json({ success: false, message: err?.message ?? "Failed to pin announcement" });
  }
});

// ── Admin: Force-show to all users (clear views) ───────────────────────────────
router.post("/admin/announcements/:id/force-show", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);

  try {
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: "Invalid announcement ID" });
      return;
    }

    await db.delete(announcementViewsTable).where(eq(announcementViewsTable.announcementId, id));

    logger.info({ id }, "announcement force-show: views cleared");

    try {
      await db.insert(adminActionLogsTable).values({
        adminId: req.session.userId!,
        targetUserId: req.session.userId!,
        action: "announcement_force_show",
        details: `Cleared views for announcement #${id} (force re-show)`,
      });
    } catch (auditErr) {
      logger.warn({ auditErr }, "audit log insert failed (non-fatal)");
    }

    res.json({ success: true });
  } catch (err: any) {
    logger.error({ err, id }, "announcement force-show error");
    res.status(500).json({ success: false, message: err?.message ?? "Failed to force-show announcement" });
  }
});

// ── User: Get active announcement ──────────────────────────────────────────────
router.get("/announcements/active", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.session.userId!;

    const popupEnabled = await getSetting("announcement_popup_enabled", "true");
    if (popupEnabled === "false") { res.json(null); return; }

    const [user] = await db
      .select({ createdAt: usersTable.createdAt, isAdmin: usersTable.isAdmin })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user || user.isAdmin) { res.json(null); return; }

    const accountAgeMs = Date.now() - new Date(user.createdAt).getTime();
    const isNewUser = accountAgeMs < 24 * 60 * 60 * 1000;

    const now = new Date();
    const activeAnnouncements = await db
      .select()
      .from(announcementsTable)
      .where(
        and(
          eq(announcementsTable.isActive, true),
          sql`(${announcementsTable.scheduledAt} IS NULL OR ${announcementsTable.scheduledAt} <= ${now})`,
          isNewUser
            ? eq(announcementsTable.showToNewUsers, true)
            : eq(announcementsTable.showToExistingUsers, true),
        )
      )
      .orderBy(desc(announcementsTable.isPinned), desc(announcementsTable.priority), desc(announcementsTable.createdAt))
      .limit(10);

    if (!activeAnnouncements.length) { res.json(null); return; }

    const frequencyHours = parseFloat(await getSetting("announcement_popup_frequency_hours", "24")) || 24;
    const showOnEveryLogin = await getSetting("announcement_popup_every_login", "false") === "true";

    for (const ann of activeAnnouncements) {
      if (!showOnEveryLogin) {
        const cutoff = new Date(Date.now() - frequencyHours * 60 * 60 * 1000);
        const [recentView] = await db
          .select()
          .from(announcementViewsTable)
          .where(
            and(
              eq(announcementViewsTable.userId, userId),
              eq(announcementViewsTable.announcementId, ann.id),
              gte(announcementViewsTable.viewedAt, cutoff),
            )
          )
          .limit(1);
        if (recentView) continue;
      }

      res.json(serializeAnnouncement(ann));
      return;
    }

    res.json(null);
  } catch (err: any) {
    logger.error({ err }, "announcements active error");
    res.json(null);
  }
});

// ── User: Mark announcement as viewed ─────────────────────────────────────────
router.post("/announcements/:id/view", requireAuth, async (req, res): Promise<void> => {
  try {
    const announcementId = parseInt(req.params.id, 10);
    if (isNaN(announcementId)) {
      res.status(400).json({ success: false, message: "Invalid ID" });
      return;
    }
    const userId = req.session.userId!;
    await db.insert(announcementViewsTable).values({ userId, announcementId });
    res.json({ success: true });
  } catch (err: any) {
    logger.error({ err }, "announcement view mark error");
    res.status(500).json({ success: false, message: err?.message ?? "Failed to record view" });
  }
});

export default router;
