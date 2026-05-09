import { Router, type IRouter } from "express";
import { eq, and, or, desc } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/notifications", requireAuth, async (req, res): Promise<void> => {
  const items = await db
    .select()
    .from(notificationsTable)
    .where(
      or(
        eq(notificationsTable.userId, req.session.userId!),
        eq(notificationsTable.isBroadcast, true)
      )
    )
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);

  const unreadCount = items.filter((n) => !n.isRead).length;

  res.json({
    items: items.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      isRead: n.isRead,
      createdAt: n.createdAt,
    })),
    unreadCount,
  });
});

router.post("/notifications/:id/read", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(
      and(
        eq(notificationsTable.id, id),
        or(
          eq(notificationsTable.userId, req.session.userId!),
          eq(notificationsTable.isBroadcast, true)
        )
      )
    );

  res.json({ success: true });
});

router.post("/notifications/read-all", requireAuth, async (req, res): Promise<void> => {
  await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(
      or(
        eq(notificationsTable.userId, req.session.userId!),
        eq(notificationsTable.isBroadcast, true)
      )
    );

  res.json({ success: true });
});

export default router;
