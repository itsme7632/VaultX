import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, desc, sql, count, sum, lt, isNull, or, inArray } from "drizzle-orm";
import multer from "multer";
import { randomUUID } from "crypto";
import path from "path";
import {
  db,
  usersTable,
  communityChannelsTable,
  communityMessagesTable,
  communityReactionsTable,
  communityReportsTable,
  communityPinnedPostsTable,
  communityBansTable,
  communityMutesTable,
  communityNotificationsTable,
  communityMembersTable,
  referralsTable,
  userInvestmentsTable,
  referralSalaryTable,
  notificationsTable,
  platformSettingsTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { broadcastToChannel, getOnlineUserCount } from "../lib/community-ws";
import {
  saveCommunityImage,
  communityImageExists,
  openCommunityImageStream,
  deleteCommunityImage,
} from "../lib/localFileStorage";

async function getSetting(key: string, fallback: string): Promise<string> {
  const [row] = await db
    .select({ value: platformSettingsTable.value })
    .from(platformSettingsTable)
    .where(eq(platformSettingsTable.key, key))
    .limit(1);
  return row?.value ?? fallback;
}

const router: IRouter = Router();

const BLOCKED_WORDS = [
  "scam", "ponzi", "hack", "phishing", "malware", "exploit",
  "rugpull", "rug pull", "exit scam",
];

function filterContent(content: string): string {
  let out = content;
  for (const word of BLOCKED_WORDS) {
    const re = new RegExp(`\\b${word}\\b`, "gi");
    out = out.replace(re, "***");
  }
  return out;
}

const rateLimitMap = new Map<number, { count: number; resetAt: number }>();
function checkRateLimit(userId: number, max = 20): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

async function isBanned(userId: number): Promise<boolean> {
  const [ban] = await db
    .select()
    .from(communityBansTable)
    .where(and(eq(communityBansTable.userId, userId), eq(communityBansTable.isActive, true)))
    .limit(1);
  return !!ban;
}

async function isMuted(userId: number): Promise<boolean> {
  const now = new Date();
  const [mute] = await db
    .select()
    .from(communityMutesTable)
    .where(and(
      eq(communityMutesTable.userId, userId),
      eq(communityMutesTable.isActive, true),
    ))
    .limit(1);
  if (!mute) return false;
  if (mute.expiresAt && mute.expiresAt < now) {
    await db.update(communityMutesTable)
      .set({ isActive: false })
      .where(eq(communityMutesTable.id, mute.id));
    return false;
  }
  return true;
}

async function getUserRole(userId: number, isAdmin: boolean): Promise<"admin" | "moderator" | "member"> {
  if (isAdmin) return "admin";
  const [member] = await db
    .select()
    .from(communityMembersTable)
    .where(eq(communityMembersTable.userId, userId))
    .limit(1);
  if (member?.communityRole === "moderator") return "moderator";
  return "member";
}

async function ensureMember(userId: number): Promise<void> {
  const [existing] = await db
    .select()
    .from(communityMembersTable)
    .where(eq(communityMembersTable.userId, userId))
    .limit(1);
  if (!existing) {
    await db.insert(communityMembersTable).values({ userId }).onConflictDoNothing();
  }
}

function canModerate(role: string): boolean {
  return role === "admin" || role === "moderator";
}

async function buildMessageShape(
  rows: any[],
  currentUserId: number,
  reactionRows: any[],
  replyRows: Map<number, any>,
) {
  return rows.map((row: any) => {
    const msgReactions = reactionRows.filter((r: any) => r.messageId === row.id);
    const emojiMap = new Map<string, { count: number; userReacted: boolean }>();
    for (const r of msgReactions) {
      const existing = emojiMap.get(r.emoji) ?? { count: 0, userReacted: false };
      emojiMap.set(r.emoji, {
        count: existing.count + 1,
        userReacted: existing.userReacted || r.userId === currentUserId,
      });
    }
    const reactions = Array.from(emojiMap.entries()).map(([emoji, d]) => ({
      emoji,
      count: d.count,
      userReacted: d.userReacted,
    }));

    const replyTo = row.replyToId ? replyRows.get(row.replyToId) : null;

    return {
      id: row.id,
      channelId: row.channelId,
      userId: row.userId,
      username: row.username ?? "Unknown",
      displayId: row.displayId ? `WX${row.displayId}` : null,
      communityRole: row.isAdmin ? "admin" : (row.communityRole ?? "member"),
      content: row.isDeleted ? "[Message removed]" : row.content,
      imageUrl: row.isDeleted ? null : row.imageUrl,
      replyToId: row.replyToId,
      replyTo: replyTo ? {
        id: replyTo.id,
        username: replyTo.username,
        content: replyTo.isDeleted ? "[Message removed]" : replyTo.content,
      } : null,
      isDeleted: row.isDeleted,
      isPinned: row.isPinned,
      isSystemMessage: row.isSystemMessage,
      reactions,
      createdAt: row.createdAt,
    };
  });
}

// ── GET /community/channels ─────────────────────────────────────────────────

router.get("/community/channels", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const channels = await db
    .select()
    .from(communityChannelsTable)
    .orderBy(communityChannelsTable.sortOrder);
  res.json(channels);
});

// ── GET /community/channels/:id/messages ───────────────────────────────────

router.get("/community/channels/:id/messages", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const channelId = parseInt(req.params.id, 10);
  const userId = req.session.userId!;
  const before = req.query.before ? parseInt(req.query.before as string, 10) : undefined;
  const limit = Math.min(parseInt((req.query.limit as string) ?? "50", 10), 100);

  await ensureMember(userId);

  const [channelRow] = await db
    .select({ type: communityChannelsTable.type })
    .from(communityChannelsTable)
    .where(eq(communityChannelsTable.id, channelId))
    .limit(1);
  const isAnnouncementChannel = channelRow?.type === "announcement";

  const rows = await db.execute(sql`
    SELECT
      m.id, m.channel_id AS "channelId", m.user_id AS "userId",
      m.content, m.image_url AS "imageUrl", m.reply_to_id AS "replyToId",
      m.is_deleted AS "isDeleted", m.is_pinned AS "isPinned",
      m.is_system_message AS "isSystemMessage", m.created_at AS "createdAt",
      u.username, u.display_id AS "displayId", u.is_admin AS "isAdmin",
      cm.community_role AS "communityRole"
    FROM community_messages m
    JOIN users u ON m.user_id = u.id
    LEFT JOIN community_members cm ON cm.user_id = m.user_id
    WHERE m.channel_id = ${channelId}
      ${before ? sql`AND m.id < ${before}` : sql``}
    ORDER BY m.id DESC
    LIMIT ${limit}
  `);

  const allRows = rows.rows as any[];
  // For announcement channels, exclude soft-deleted messages (legacy entries);
  // hard-deleted ones are already gone from the DB.
  const messages = isAnnouncementChannel
    ? allRows.filter((m: any) => !m.isDeleted)
    : allRows;
  if (!messages.length) {
    res.json([]);
    return;
  }

  const messageIds = messages.map((m: any) => m.id as number);

  // Use inArray (not sql`ANY(${array}::int[])`) — the latter generates invalid
  // parameterised SQL: ANY(($1,$2)::int[]) which Postgres rejects.
  const rawReactions = messageIds.length > 0
    ? await db
        .select({
          messageId: communityReactionsTable.messageId,
          userId: communityReactionsTable.userId,
          emoji: communityReactionsTable.emoji,
        })
        .from(communityReactionsTable)
        .where(inArray(communityReactionsTable.messageId, messageIds))
    : [];

  const replyToIds = [...new Set(
    messages.filter((m: any) => m.replyToId).map((m: any) => m.replyToId as number)
  )];
  let replyRows = new Map<number, any>();
  if (replyToIds.length > 0) {
    const replyData = await db
      .select({
        id: communityMessagesTable.id,
        content: communityMessagesTable.content,
        isDeleted: communityMessagesTable.isDeleted,
        username: usersTable.username,
      })
      .from(communityMessagesTable)
      .innerJoin(usersTable, eq(usersTable.id, communityMessagesTable.userId))
      .where(inArray(communityMessagesTable.id, replyToIds));
    for (const r of replyData) {
      replyRows.set(r.id, r);
    }
  }

  const shaped = await buildMessageShape(messages, userId, rawReactions as any[], replyRows);
  res.json(shaped.reverse());
});

// ── POST /community/channels/:id/messages ──────────────────────────────────

router.post("/community/channels/:id/messages", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const channelId = parseInt(req.params.id, 10);
  const userId = req.session.userId!;

  // Always check DB for isAdmin so newly-promoted admins work without re-login
  const [dbUser] = await db
    .select({ isAdmin: usersTable.isAdmin })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  const isAdmin = dbUser?.isAdmin ?? false;
  // Sync session so future middleware checks are also correct
  if (isAdmin && !req.session.isAdmin) req.session.isAdmin = true;

  const [channel] = await db
    .select()
    .from(communityChannelsTable)
    .where(eq(communityChannelsTable.id, channelId))
    .limit(1);

  if (!channel) { res.status(404).json({ error: "Channel not found" }); return; }

  if (channel.type === "announcement" && !isAdmin) {
    res.status(403).json({ error: "Only admins can post announcements" });
    return;
  }

  if (channel.isLocked && !isAdmin) {
    res.status(403).json({ error: "Channel is locked" });
    return;
  }

  if (await isBanned(userId)) {
    res.status(403).json({ error: "You are banned from the community" });
    return;
  }
  if (!isAdmin && await isMuted(userId)) {
    res.status(403).json({ error: "You are muted" });
    return;
  }
  if (!isAdmin && !checkRateLimit(userId)) {
    res.status(429).json({ error: "Too many messages. Please slow down." });
    return;
  }

  const { content = "", imageUrl, replyToId, isPinned } = req.body;
  if (!content.trim() && !imageUrl) {
    res.status(400).json({ error: "Message cannot be empty" });
    return;
  }
  if (content.length > 2000) {
    res.status(400).json({ error: "Message too long (max 2000 chars)" });
    return;
  }

  const filtered = filterContent(content.trim());

  await ensureMember(userId);

  const [msg] = await db.insert(communityMessagesTable).values({
    channelId,
    userId,
    content: filtered,
    imageUrl: imageUrl ?? null,
    replyToId: replyToId ?? null,
    isPinned: isAdmin && isPinned ? true : false,
  }).returning();

  const [user] = await db
    .select({ username: usersTable.username, displayId: usersTable.displayId, isAdmin: usersTable.isAdmin })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  const [member] = await db
    .select({ communityRole: communityMembersTable.communityRole })
    .from(communityMembersTable)
    .where(eq(communityMembersTable.userId, userId))
    .limit(1);

  let replyTo = null;
  if (replyToId) {
    const replyRows = await db.execute(sql`
      SELECT m.id, m.content, m.is_deleted AS "isDeleted", u.username
      FROM community_messages m JOIN users u ON m.user_id = u.id
      WHERE m.id = ${replyToId} LIMIT 1
    `);
    if ((replyRows.rows as any[]).length > 0) {
      const r = (replyRows.rows as any[])[0];
      replyTo = { id: r.id, username: r.username, content: r.isDeleted ? "[Message removed]" : r.content };
    }
  }

  const shaped = {
    id: msg.id,
    channelId: msg.channelId,
    userId: msg.userId,
    username: user?.username ?? "Unknown",
    displayId: user?.displayId ? `WX${user.displayId}` : null,
    communityRole: user?.isAdmin ? "admin" : (member?.communityRole ?? "member"),
    content: msg.content,
    imageUrl: msg.imageUrl,
    replyToId: msg.replyToId,
    replyTo,
    isDeleted: false,
    isPinned: msg.isPinned,
    isSystemMessage: false,
    reactions: [],
    createdAt: msg.createdAt,
  };

  broadcastToChannel(channelId, { type: "message", data: shaped });

  if (channel.type === "announcement") {
    const notificationsEnabled = await getSetting("community_notifications_enabled", "true");
    if (notificationsEnabled !== "false") {
      const allUsers = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(and(eq(usersTable.isActive, true), eq(usersTable.isAdmin, false)));
      const notifs = allUsers.map((u: { id: number }) => ({
        userId: u.id,
        type: "community_announcement" as const,
        title: "📢 New Announcement",
        message: filtered.slice(0, 120) + (filtered.length > 120 ? "…" : ""),
        isRead: false,
        isBroadcast: false,
      }));
      if (notifs.length > 0) {
        for (let i = 0; i < notifs.length; i += 100) {
          await db.insert(notificationsTable).values(notifs.slice(i, i + 100)).onConflictDoNothing();
        }
      }
    }
  }

  res.json(shaped);
});

// ── POST /community/messages/:id/react ─────────────────────────────────────

router.post("/community/messages/:id/react", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const messageId = parseInt(req.params.id, 10);
  const userId = req.session.userId!;
  const { emoji } = req.body;

  if (!emoji || typeof emoji !== "string" || emoji.length > 10) {
    res.status(400).json({ error: "Invalid emoji" });
    return;
  }

  if (await isBanned(userId)) {
    res.status(403).json({ error: "You are banned" });
    return;
  }

  const [existing] = await db
    .select()
    .from(communityReactionsTable)
    .where(and(
      eq(communityReactionsTable.messageId, messageId),
      eq(communityReactionsTable.userId, userId),
      eq(communityReactionsTable.emoji, emoji),
    ))
    .limit(1);

  let added: boolean;
  if (existing) {
    await db.delete(communityReactionsTable).where(eq(communityReactionsTable.id, existing.id));
    added = false;
  } else {
    await db.insert(communityReactionsTable).values({ messageId, userId, emoji });
    added = true;
  }

  const [msg] = await db.select({ channelId: communityMessagesTable.channelId })
    .from(communityMessagesTable).where(eq(communityMessagesTable.id, messageId)).limit(1);
  if (msg) {
    broadcastToChannel(msg.channelId, { type: "reaction", messageId, emoji, userId, added });
  }

  res.json({ added, emoji, messageId });
});

// ── POST /community/messages/:id/report ────────────────────────────────────

router.post("/community/messages/:id/report", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const messageId = parseInt(req.params.id, 10);
  const reporterId = req.session.userId!;
  const { reason = "Inappropriate content" } = req.body;

  await db.insert(communityReportsTable).values({ messageId, reporterId, reason });

  const admins = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.isAdmin, true));
  for (const admin of admins) {
    await db.insert(communityNotificationsTable).values({
      userId: admin.id,
      type: "report",
      messageId,
      title: "🚨 Message Reported",
      body: `Reason: ${reason}`,
    });
  }

  res.json({ success: true });
});

// ── DELETE /community/messages/:id ─────────────────────────────────────────

router.delete("/community/messages/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const messageId = parseInt(req.params.id, 10);
  const userId = req.session.userId!;

  // Always check isAdmin from DB — session can be stale after promotion
  const [userRow] = await db
    .select({ isAdmin: usersTable.isAdmin })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  const isAdmin = userRow?.isAdmin ?? false;
  const role = await getUserRole(userId, isAdmin);

  const [msg] = await db
    .select()
    .from(communityMessagesTable)
    .where(eq(communityMessagesTable.id, messageId))
    .limit(1);

  if (!msg) { res.status(404).json({ error: "Message not found" }); return; }

  if (!canModerate(role) && msg.userId !== userId) {
    res.status(403).json({ error: "Not allowed" });
    return;
  }

  // Get channel type to decide hard vs soft delete
  const [channelRow] = await db
    .select({ type: communityChannelsTable.type })
    .from(communityChannelsTable)
    .where(eq(communityChannelsTable.id, msg.channelId))
    .limit(1);
  const isAnnouncement = channelRow?.type === "announcement";

  // Always clean up pin record to prevent orphaned pins
  await db
    .delete(communityPinnedPostsTable)
    .where(eq(communityPinnedPostsTable.messageId, messageId));

  await db.insert(communityMembersTable).values({ userId, communityRole: "member" }).onConflictDoNothing();

  if (isAnnouncement) {
    // Hard delete: remove from DB entirely — no "[Message removed]" in Announcements
    await db
      .delete(communityMessagesTable)
      .where(eq(communityMessagesTable.id, messageId));
    // Clean up image file from disk if present
    if (msg.imageUrl) {
      const imgMatch = (msg.imageUrl as string).match(/\/api\/community\/images\/([^/]+)$/);
      if (imgMatch) { try { await deleteCommunityImage(imgMatch[1]); } catch {} }
    }
    broadcastToChannel(msg.channelId, { type: "delete", messageId, hardDelete: true });
  } else {
    // Soft delete: mark as deleted, show "[Message removed]" in Chat/Support
    await db
      .update(communityMessagesTable)
      .set({ isDeleted: true, deletedBy: userId, imageUrl: null })
      .where(eq(communityMessagesTable.id, messageId));
    // Clean up image file from disk if present
    if (msg.imageUrl) {
      const imgMatch = (msg.imageUrl as string).match(/\/api\/community\/images\/([^/]+)$/);
      if (imgMatch) { try { await deleteCommunityImage(imgMatch[1]); } catch {} }
    }
    broadcastToChannel(msg.channelId, { type: "delete", messageId, hardDelete: false });
  }

  res.json({ success: true });
});

// ── POST /community/messages/:id/pin ───────────────────────────────────────

router.post("/community/messages/:id/pin", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const messageId = parseInt(req.params.id, 10);
  const userId = req.session.userId!;
  const isAdmin = req.session.isAdmin ?? false;
  const role = await getUserRole(userId, isAdmin);

  if (!canModerate(role)) { res.status(403).json({ error: "Not allowed" }); return; }

  const [msg] = await db
    .select()
    .from(communityMessagesTable)
    .where(eq(communityMessagesTable.id, messageId))
    .limit(1);
  if (!msg) { res.status(404).json({ error: "Message not found" }); return; }

  const newPinned = !msg.isPinned;
  await db.update(communityMessagesTable)
    .set({ isPinned: newPinned })
    .where(eq(communityMessagesTable.id, messageId));

  if (newPinned) {
    await db.insert(communityPinnedPostsTable).values({
      channelId: msg.channelId,
      messageId,
      pinnedBy: userId,
    }).onConflictDoNothing();
  } else {
    await db.execute(sql`DELETE FROM community_pinned_posts WHERE message_id = ${messageId}`);
  }

  broadcastToChannel(msg.channelId, { type: "pin", messageId, isPinned: newPinned });
  res.json({ success: true, isPinned: newPinned });
});

// ── GET /community/leaderboard ─────────────────────────────────────────────

router.get("/community/leaderboard", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const [referrers, investors, salaryEarners] = await Promise.all([
    db.execute(sql`
      SELECT u.username, u.display_id AS "displayId", COUNT(r.id)::int AS total,
             SUM(CAST(r.commission_amount AS numeric))::float AS earned
      FROM referrals r
      JOIN users u ON r.referrer_id = u.id
      WHERE u.is_admin = false AND u.is_active = true
      GROUP BY u.id, u.username, u.display_id
      ORDER BY total DESC
      LIMIT 10
    `),
    db.execute(sql`
      SELECT u.username, u.display_id AS "displayId",
             SUM(CAST(ui.amount AS numeric))::float AS "totalInvested",
             COUNT(ui.id)::int AS "planCount"
      FROM user_investments ui
      JOIN users u ON ui.user_id = u.id
      WHERE u.is_admin = false AND u.is_active = true
      GROUP BY u.id, u.username, u.display_id
      ORDER BY "totalInvested" DESC
      LIMIT 10
    `),
    db.execute(sql`
      SELECT u.username, u.display_id AS "displayId",
             CAST(rs.total_salary_paid AS float) AS "totalPaid",
             rs.current_tier AS "currentTier"
      FROM referral_salary rs
      JOIN users u ON rs.user_id = u.id
      WHERE rs.is_active = true AND u.is_admin = false
      ORDER BY rs.total_salary_paid DESC
      LIMIT 10
    `),
  ]);

  res.json({
    referrers: (referrers.rows as any[]).map((r: any, i: number) => ({
      rank: i + 1,
      username: r.username,
      displayId: r.displayId ? `WX${r.displayId}` : null,
      totalReferrals: r.total,
      totalEarned: r.earned ?? 0,
    })),
    investors: (investors.rows as any[]).map((r: any, i: number) => ({
      rank: i + 1,
      username: r.username,
      displayId: r.displayId ? `WX${r.displayId}` : null,
      totalInvested: r.totalInvested ?? 0,
      planCount: r.planCount,
    })),
    salaryEarners: (salaryEarners.rows as any[]).map((r: any, i: number) => ({
      rank: i + 1,
      username: r.username,
      displayId: r.displayId ? `WX${r.displayId}` : null,
      totalPaid: r.totalPaid ?? 0,
      currentTier: r.currentTier,
    })),
  });
});

// ── GET /community/analytics (admin only) ─────────────────────────────────

router.get("/community/analytics", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.session.isAdmin) { res.status(403).json({ error: "Admin only" }); return; }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);

  const [
    totalMembers,
    activeMembers,
    messagesToday,
    messagesWeek,
    newMembersToday,
    totalMessages,
  ] = await Promise.all([
    db.execute(sql`SELECT COUNT(*)::int AS c FROM users WHERE is_active = true AND is_admin = false`),
    db.execute(sql`SELECT COUNT(*)::int AS c FROM community_members`),
    db.execute(sql`SELECT COUNT(*)::int AS c FROM community_messages WHERE created_at >= ${today.toISOString()} AND is_deleted = false`),
    db.execute(sql`SELECT COUNT(*)::int AS c FROM community_messages WHERE created_at >= ${weekAgo.toISOString()} AND is_deleted = false`),
    db.execute(sql`SELECT COUNT(*)::int AS c FROM users WHERE created_at >= ${today.toISOString()} AND is_admin = false`),
    db.execute(sql`SELECT COUNT(*)::int AS c FROM community_messages WHERE is_deleted = false`),
  ]);

  res.json({
    totalMembers: (totalMembers.rows[0] as any)?.c ?? 0,
    activeMembers: (activeMembers.rows[0] as any)?.c ?? 0,
    onlineUsers: getOnlineUserCount(),
    messagesToday: (messagesToday.rows[0] as any)?.c ?? 0,
    messagesWeek: (messagesWeek.rows[0] as any)?.c ?? 0,
    newMembersToday: (newMembersToday.rows[0] as any)?.c ?? 0,
    totalMessages: (totalMessages.rows[0] as any)?.c ?? 0,
  });
});

// ── POST /community/admin/ban/:userId ─────────────────────────────────────

router.post("/community/admin/ban/:userId", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const adminId = req.session.userId!;
  const isAdmin = req.session.isAdmin ?? false;
  const role = await getUserRole(adminId, isAdmin);
  if (!canModerate(role)) { res.status(403).json({ error: "Not allowed" }); return; }

  const targetUserId = parseInt(req.params.userId, 10);
  const { reason = "" } = req.body;

  await db.update(communityBansTable)
    .set({ isActive: false })
    .where(eq(communityBansTable.userId, targetUserId));

  await db.insert(communityBansTable).values({ userId: targetUserId, bannedBy: adminId, reason, isActive: true });

  res.json({ success: true });
});

// ── DELETE /community/admin/ban/:userId ────────────────────────────────────

router.delete("/community/admin/ban/:userId", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.session.isAdmin) { res.status(403).json({ error: "Admin only" }); return; }
  const targetUserId = parseInt(req.params.userId, 10);
  await db.update(communityBansTable).set({ isActive: false }).where(eq(communityBansTable.userId, targetUserId));
  res.json({ success: true });
});

// ── POST /community/admin/mute/:userId ────────────────────────────────────

router.post("/community/admin/mute/:userId", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const adminId = req.session.userId!;
  const isAdmin = req.session.isAdmin ?? false;
  const role = await getUserRole(adminId, isAdmin);
  if (!canModerate(role)) { res.status(403).json({ error: "Not allowed" }); return; }

  const targetUserId = parseInt(req.params.userId, 10);
  const { reason = "", durationMinutes = 60 } = req.body;
  const expiresAt = new Date(Date.now() + durationMinutes * 60_000);

  await db.update(communityMutesTable).set({ isActive: false }).where(eq(communityMutesTable.userId, targetUserId));
  await db.insert(communityMutesTable).values({ userId: targetUserId, mutedBy: adminId, reason, expiresAt, isActive: true });

  res.json({ success: true, expiresAt });
});

// ── DELETE /community/admin/mute/:userId ───────────────────────────────────

router.delete("/community/admin/mute/:userId", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.session.isAdmin) { res.status(403).json({ error: "Admin only" }); return; }
  await db.update(communityMutesTable).set({ isActive: false }).where(eq(communityMutesTable.userId, parseInt(req.params.userId, 10)));
  res.json({ success: true });
});

// ── PUT /community/admin/lock/:channelId ───────────────────────────────────

router.put("/community/admin/lock/:channelId", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.session.isAdmin) { res.status(403).json({ error: "Admin only" }); return; }
  const channelId = parseInt(req.params.channelId, 10);
  const [ch] = await db.select().from(communityChannelsTable).where(eq(communityChannelsTable.id, channelId)).limit(1);
  if (!ch) { res.status(404).json({ error: "Channel not found" }); return; }
  const newLocked = !ch.isLocked;
  await db.update(communityChannelsTable).set({ isLocked: newLocked }).where(eq(communityChannelsTable.id, channelId));
  broadcastToChannel(channelId, { type: "lock", channelId, isLocked: newLocked });
  res.json({ success: true, isLocked: newLocked });
});

// ── PUT /community/admin/role ─────────────────────────────────────────────

router.put("/community/admin/role", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.session.isAdmin) { res.status(403).json({ error: "Admin only" }); return; }
  const { userId, role } = req.body;
  if (!["member", "moderator"].includes(role)) { res.status(400).json({ error: "Invalid role" }); return; }

  await db.insert(communityMembersTable).values({ userId, communityRole: role })
    .onConflictDoUpdate({ target: communityMembersTable.userId, set: { communityRole: role } });
  res.json({ success: true });
});

// ── POST /community/admin/notify (admin-only standalone blast) ────────────

router.post("/community/admin/notify", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.session.isAdmin) { res.status(403).json({ error: "Admin only" }); return; }

  const { title = "📢 New Announcement", message = "" } = req.body;
  if (!message.trim()) { res.status(400).json({ error: "Message is required" }); return; }

  const notificationsEnabled = await getSetting("community_notifications_enabled", "true");
  if (notificationsEnabled === "false") {
    res.status(400).json({ error: "Community notifications are disabled" });
    return;
  }

  const allUsers = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(eq(usersTable.isActive, true), eq(usersTable.isAdmin, false)));

  const notifs = allUsers.map((u: { id: number }) => ({
    userId: u.id,
    type: "community_announcement" as const,
    title,
    message: message.slice(0, 200),
    isRead: false,
    isBroadcast: false,
  }));

  if (notifs.length > 0) {
    for (let i = 0; i < notifs.length; i += 100) {
      await db.insert(notificationsTable).values(notifs.slice(i, i + 100)).onConflictDoNothing();
    }
  }

  res.json({ success: true, sentTo: notifs.length });
});

// ── GET /community/notifications ──────────────────────────────────────────

router.get("/community/notifications", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.session.userId!;
  const notifs = await db
    .select()
    .from(communityNotificationsTable)
    .where(eq(communityNotificationsTable.userId, userId))
    .orderBy(desc(communityNotificationsTable.createdAt))
    .limit(30);
  res.json(notifs);
});

// ── POST /community/notifications/read-all ────────────────────────────────

router.post("/community/notifications/read-all", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.session.userId!;
  await db.update(communityNotificationsTable)
    .set({ isRead: true })
    .where(eq(communityNotificationsTable.userId, userId));
  res.json({ success: true });
});

// ── GET /community/reports (admin only) ───────────────────────────────────

router.get("/community/reports", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.session.isAdmin) { res.status(403).json({ error: "Admin only" }); return; }
  const reports = await db.execute(sql`
    SELECT cr.id, cr.message_id AS "messageId", cr.reason, cr.status, cr.created_at AS "createdAt",
           u.username AS "reporterUsername",
           m.content AS "messageContent", mu.username AS "messageAuthor"
    FROM community_reports cr
    JOIN users u ON cr.reporter_id = u.id
    JOIN community_messages m ON cr.message_id = m.id
    JOIN users mu ON m.user_id = mu.id
    ORDER BY cr.created_at DESC
    LIMIT 50
  `);
  res.json(reports.rows);
});

// ── Image upload setup ─────────────────────────────────────────────────────

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB hard limit
});

// Allowed MIME types and their magic-byte signatures
const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": "jpeg",
  "image/jpg":  "jpeg",
  "image/png":  "png",
  "image/webp": "webp",
};

function detectImageType(buf: Buffer): string | null {
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  // WebP: RIFF????WEBP
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return "image/webp";
  return null;
}

// ── POST /community/upload-image ───────────────────────────────────────────

// Wrap multer so LIMIT_FILE_SIZE returns JSON 400 instead of an unhandled 500
function uploadSingle(req: Request, res: Response, next: (err?: any) => void): void {
  imageUpload.single("image")(req, res, (err: any) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({ error: "Image exceeds 5 MB limit" });
      } else {
        res.status(400).json({ error: err.message ?? "Upload error" });
      }
      return;
    }
    next();
  });
}

router.post(
  "/community/upload-image",
  requireAuth,
  uploadSingle,
  async (req: Request, res: Response): Promise<void> => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No image file provided" });
      return;
    }

    // Validate size (multer limit is 5MB, but enforce explicitly too)
    if (file.size > 5 * 1024 * 1024) {
      res.status(400).json({ error: "Image exceeds 5 MB limit" });
      return;
    }

    // Server-side MIME validation via magic bytes (not trusting Content-Type)
    const detected = detectImageType(file.buffer);
    if (!detected || !ALLOWED_MIME[detected]) {
      res.status(400).json({
        error: "Unsupported format. Only JPG, PNG, and WebP images are allowed.",
      });
      return;
    }

    const ext = ALLOWED_MIME[detected]; // "jpeg" | "png" | "webp"
    const filename = `${randomUUID()}.${ext}`;

    try {
      await saveCommunityImage(file.buffer, filename);
      res.json({ imageUrl: `/api/community/images/${filename}` });
    } catch (err: any) {
      console.error("[Community] Image upload error:", err);
      res.status(500).json({ error: "Failed to save image" });
    }
  }
);

// ── GET /community/images/:filename ───────────────────────────────────────
// Public: any authenticated user can view community images

router.get("/community/images/:filename", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const filename = path.basename(req.params.filename); // prevent traversal

  const exists = await communityImageExists(filename);
  if (!exists) {
    res.status(404).json({ error: "Image not found" });
    return;
  }

  // Determine content type from extension
  const ext = filename.split(".").pop()?.toLowerCase();
  const contentTypeMap: Record<string, string> = {
    jpeg: "image/jpeg",
    png:  "image/png",
    webp: "image/webp",
  };
  const contentType = ext ? (contentTypeMap[ext] ?? "application/octet-stream") : "application/octet-stream";

  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.setHeader("X-Content-Type-Options", "nosniff");

  const stream = openCommunityImageStream(filename);
  stream.on("error", (err) => {
    console.error("[Community] Image stream error:", err);
    if (!res.headersSent) res.status(500).json({ error: "Failed to stream image" });
    else res.destroy();
  });
  stream.pipe(res);
});

// ── DELETE /community/images/:filename (admin or owner via message delete) ─
// Images are cleaned up when their parent message is deleted.
// Exported for use by the message delete route.
export async function cleanupMessageImage(imageUrl: string | null): Promise<void> {
  if (!imageUrl) return;
  const match = imageUrl.match(/\/api\/community\/images\/([^/]+)$/);
  if (!match) return;
  try { await deleteCommunityImage(match[1]); } catch {}
}

export default router;
