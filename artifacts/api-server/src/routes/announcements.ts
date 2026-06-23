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
  const [row] = await db
    .select()
    .from(platformSettingsTable)
    .where(eq(platformSettingsTable.key, key))
    .limit(1);
  return row?.value ?? fallback;
}

// ── Admin: List all announcements ──────────────────────────────────────────────
router.get("/admin/announcements", requireAdmin, async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(announcementsTable)
    .orderBy(desc(announcementsTable.isPinned), desc(announcementsTable.priority), desc(announcementsTable.createdAt));
  res.json(rows.map(serializeAnnouncement));
});

// ── Admin: Create announcement ─────────────────────────────────────────────────
router.post("/admin/announcements", requireAdmin, async (req, res): Promise<void> => {
  const {
    title, content, isActive = false, priority = 0,
    showToNewUsers = true, showToExistingUsers = true,
    isPinned = false, scheduledAt,
  } = req.body;

  if (!title?.trim()) { res.status(400).json({ error: "Title required" }); return; }
  if (!content?.trim()) { res.status(400).json({ error: "Content required" }); return; }

  const [row] = await db.insert(announcementsTable).values({
    title: title.trim(),
    content: content.trim(),
    isActive,
    priority: parseInt(String(priority), 10) || 0,
    showToNewUsers,
    showToExistingUsers,
    isPinned,
    scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    createdBy: req.session.userId!,
  }).returning();

  // Audit log
  await db.insert(adminActionLogsTable).values({
    adminId: req.session.userId!,
    targetUserId: req.session.userId!,
    action: "announcement_created",
    details: `Created announcement: "${title.trim()}"`,
  });

  res.status(201).json(serializeAnnouncement(row));
});

// ── Admin: Update announcement ─────────────────────────────────────────────────
router.put("/admin/announcements/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const {
    title, content, isActive, priority,
    showToNewUsers, showToExistingUsers, isPinned, scheduledAt,
  } = req.body;

  const existing = await db.select().from(announcementsTable).where(eq(announcementsTable.id, id)).limit(1);
  if (!existing.length) { res.status(404).json({ error: "Not found" }); return; }

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

  await db.insert(adminActionLogsTable).values({
    adminId: req.session.userId!,
    targetUserId: req.session.userId!,
    action: "announcement_updated",
    details: `Updated announcement #${id}: "${row.title}"`,
  });

  res.json(serializeAnnouncement(row));
});

// ── Admin: Delete announcement ─────────────────────────────────────────────────
router.delete("/admin/announcements/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const existing = await db.select().from(announcementsTable).where(eq(announcementsTable.id, id)).limit(1);
  if (!existing.length) { res.status(404).json({ error: "Not found" }); return; }

  await db.delete(announcementViewsTable).where(eq(announcementViewsTable.announcementId, id));
  await db.delete(announcementsTable).where(eq(announcementsTable.id, id));

  await db.insert(adminActionLogsTable).values({
    adminId: req.session.userId!,
    targetUserId: req.session.userId!,
    action: "announcement_deleted",
    details: `Deleted announcement #${id}: "${existing[0].title}"`,
  });

  res.json({ success: true });
});

// ── Admin: Toggle active ───────────────────────────────────────────────────────
router.patch("/admin/announcements/:id/toggle", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [existing] = await db.select().from(announcementsTable).where(eq(announcementsTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const [row] = await db
    .update(announcementsTable)
    .set({ isActive: !existing.isActive })
    .where(eq(announcementsTable.id, id))
    .returning();

  res.json(serializeAnnouncement(row));
});

// ── Admin: Force-show to all users (clear views) ───────────────────────────────
router.post("/admin/announcements/:id/force-show", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  await db.delete(announcementViewsTable).where(eq(announcementViewsTable.announcementId, id));

  await db.insert(adminActionLogsTable).values({
    adminId: req.session.userId!,
    targetUserId: req.session.userId!,
    action: "announcement_force_show",
    details: `Cleared views for announcement #${id} (force re-show)`,
  });

  res.json({ success: true });
});

// ── User: Get active announcement ──────────────────────────────────────────────
router.get("/announcements/active", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  // Check if popup system is enabled
  const popupEnabled = await getSetting("announcement_popup_enabled", "true");
  if (popupEnabled === "false") { res.json(null); return; }

  // Get current user's account age
  const [user] = await db
    .select({ createdAt: usersTable.createdAt, isAdmin: usersTable.isAdmin })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user || user.isAdmin) { res.json(null); return; }

  const accountAgeMs = Date.now() - new Date(user.createdAt).getTime();
  const isNewUser = accountAgeMs < 24 * 60 * 60 * 1000; // < 24 hours old

  // Find the best active announcement
  // Respect scheduling: only show if scheduledAt is null or in the past
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

  // Get popup frequency setting (in hours, default 24)
  const frequencyHours = parseFloat(await getSetting("announcement_popup_frequency_hours", "24")) || 24;
  const showOnEveryLogin = await getSetting("announcement_popup_every_login", "false") === "true";

  // Find the first announcement the user hasn't viewed within the frequency window
  for (const ann of activeAnnouncements) {
    // If "show on every login" is off, check the view window
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
      if (recentView) continue; // Already seen recently
    }

    // This announcement should be shown
    res.json(serializeAnnouncement(ann));
    return;
  }

  res.json(null);
});

// ── User: Mark announcement as viewed ─────────────────────────────────────────
router.post("/announcements/:id/view", requireAuth, async (req, res): Promise<void> => {
  const announcementId = parseInt(req.params.id, 10);
  const userId = req.session.userId!;

  await db.insert(announcementViewsTable).values({ userId, announcementId });
  res.json({ success: true });
});

export default router;
