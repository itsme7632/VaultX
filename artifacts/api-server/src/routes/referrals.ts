import { Router, type IRouter } from "express";
import { eq, desc, count, sum, and, sql } from "drizzle-orm";
import { db, usersTable, referralsTable, walletsTable, transactionsTable, notificationsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { generateTxId } from "../lib/generate-tx-id";

const router: IRouter = Router();

const TIERS = [
  { min: 20, rate: 0.12, label: "Diamond" },
  { min: 10, rate: 0.10, label: "Gold" },
  { min: 5,  rate: 0.07, label: "Silver" },
  { min: 0,  rate: 0.05, label: "Bronze" },
] as const;

function getTier(total: number) {
  return TIERS.find((t) => total >= t.min) ?? TIERS[TIERS.length - 1];
}

function getNextTier(total: number) {
  const thresholds = [5, 10, 20];
  const next = thresholds.find((t) => total < t);
  return next ?? null;
}

router.get("/referrals", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId!))
    .limit(1);

  const [wallet] = await db
    .select()
    .from(walletsTable)
    .where(eq(walletsTable.userId, req.session.userId!))
    .limit(1);

  const referrals = await db
    .select()
    .from(referralsTable)
    .where(eq(referralsTable.referrerId, req.session.userId!));

  const totalEarned = referrals.reduce(
    (acc, r) => acc + parseFloat(r.commissionAmount),
    0
  );
  const activeReferrals = referrals.filter((r) => r.status !== "pending").length;
  const total = referrals.length;
  const currentTier = getTier(total);
  const nextTierAt = getNextTier(total);
  const pendingEarnings = wallet ? parseFloat(wallet.referralPendingEarnings) : 0;

  res.json({
    code: user.referralCode,
    totalReferrals: total,
    activeReferrals,
    totalEarned,
    pendingEarnings,
    commissionRate: currentTier.rate,
    tierLabel: currentTier.label,
    nextTierAt,
    tiers: TIERS.map((t) => ({ ...t })),
  });
});

router.post("/referrals/claim", requireAuth, async (req, res): Promise<void> => {
  const [wallet] = await db
    .select()
    .from(walletsTable)
    .where(eq(walletsTable.userId, req.session.userId!))
    .limit(1);

  if (!wallet) {
    res.status(404).json({ error: "Wallet not found" });
    return;
  }

  const pending = parseFloat(wallet.referralPendingEarnings);
  if (pending <= 0) {
    res.status(400).json({ error: "No pending earnings", message: "You have no pending referral earnings to claim" });
    return;
  }

  await db.update(walletsTable).set({
    balance: sql`balance + ${pending.toFixed(8)}`,
    totalEarnings: sql`total_earnings + ${pending.toFixed(8)}`,
    referralPendingEarnings: "0",
  }).where(eq(walletsTable.userId, req.session.userId!));

  await db.insert(transactionsTable).values({
    userId: req.session.userId!,
    type: "referral",
    amount: pending.toFixed(8),
    status: "completed",
    txId: generateTxId(),
    note: `Referral earnings claimed`,
  });

  res.json({ success: true, amountClaimed: pending });
});

router.get("/referrals/history", requireAuth, async (req, res): Promise<void> => {
  // Per-referral breakdown: each referred user with total earned + last activity
  const referrals = await db
    .select({
      ref: referralsTable,
      username: usersTable.username,
      fullName: usersTable.fullName,
    })
    .from(referralsTable)
    .leftJoin(usersTable, eq(referralsTable.referredId, usersTable.id))
    .where(eq(referralsTable.referrerId, req.session.userId!))
    .orderBy(desc(referralsTable.createdAt));

  // Get recent referral transactions to compute per-user breakdown
  const allTxs = await db
    .select()
    .from(transactionsTable)
    .where(and(eq(transactionsTable.userId, req.session.userId!), eq(transactionsTable.type, "referral"), eq(transactionsTable.status, "completed")))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(200);

  // Map each transaction to its source: parse "@username" from note
  const txWithSource = allTxs.map((t) => {
    const depositMatch = t.note?.match(/@(\w+) deposit/i);
    const earningsMatch = t.note?.match(/from (.+?) earnings/i);
    return {
      id: t.id,
      referredUsername: depositMatch?.[1] ?? null,
      source: depositMatch ? "deposit" : earningsMatch ? "investment" : "other",
      planOrNote: earningsMatch?.[1] ?? t.note,
      amount: parseFloat(t.amount),
      createdAt: t.createdAt,
    };
  });

  res.json({
    perUser: referrals.map((row) => ({
      id: row.ref.id,
      referredUsername: row.username ?? "Unknown",
      totalEarned: parseFloat(row.ref.commissionAmount),
      status: row.ref.status,
      joinedAt: row.ref.createdAt,
    })),
    transactions: txWithSource,
  });
});

router.get("/referrals/leaderboard", requireAuth, async (req, res): Promise<void> => {
  const result = await db
    .select({
      referrerId: referralsTable.referrerId,
      totalReferrals: count(referralsTable.id),
      totalEarned: sum(referralsTable.commissionAmount),
      username: usersTable.username,
    })
    .from(referralsTable)
    .leftJoin(usersTable, eq(referralsTable.referrerId, usersTable.id))
    .groupBy(referralsTable.referrerId, usersTable.username)
    .orderBy(desc(count(referralsTable.id)))
    .limit(20);

  res.json(
    result.map((row, index) => ({
      rank: index + 1,
      username: row.username ?? "Unknown",
      totalReferrals: row.totalReferrals,
      totalEarned: parseFloat(row.totalEarned ?? "0"),
    }))
  );
});

export default router;
