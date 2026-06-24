import { Router, type IRouter } from "express";
import { and, or, isNull, lte, gte, desc, eq } from "drizzle-orm";
import { db, popupAnnouncementsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/announcements/active", requireAuth, async (req, res): Promise<void> => {
  try {
    const now = new Date();
    const rows = await db
      .select()
      .from(popupAnnouncementsTable)
      .where(
        and(
          eq(popupAnnouncementsTable.isActive, true),
          or(
            isNull(popupAnnouncementsTable.scheduledAt),
            lte(popupAnnouncementsTable.scheduledAt, now),
          ),
          or(
            isNull(popupAnnouncementsTable.expiresAt),
            gte(popupAnnouncementsTable.expiresAt, now),
          ),
        ),
      )
      .orderBy(desc(popupAnnouncementsTable.isPinned), desc(popupAnnouncementsTable.createdAt));

    res.json(rows);
  } catch (err) {
    console.error("[announcements] GET /active error:", err);
    res.status(500).json({ error: "Failed to fetch announcements" });
  }
});

export default router;
