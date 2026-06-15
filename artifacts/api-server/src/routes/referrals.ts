import { Router, type IRouter } from "express";
import { eq, desc, count, sum, and, sql } from "drizzle-orm";
import { db, usersTable, referralsTable, walletsTable, transactionsTable, notificationsTable, platformSettingsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { generateTxId } from "../lib/generate-tx-id";

const router: IRouter = Router();

async function getSetting(key: string, fallback: string): Promise<string> {
  const [s] = await db.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, key)).limit(1);
  return s?.value ?? fallback;
}

const TIER_THRESHOLDS = [
  { min: 20, label: "Diamond" },
  { min: 10, label: "Gold" },
  { min: 5,  label: "Silver" },
  { min: 0,  label: "Bronze" },
] as const;

function getTierLabel(total: number): string {
  return TIER_THRESHOLDS.find((t) => total >= t.min)?.label ?? "Bronze";
}

function getNextTierAt(total: number): number | null {
  const thresholds = [5, 10, 20];
  return thresholds.find((t) => total < t) ?? null;
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
  const tierLabel = getTierLabel(total);
  const nextTierAt = getNextTierAt(total);
  const pendingEarnings = wallet ? parseFloat(wallet.referralPendingEarnings) : 0;

  const [
    l1DepositRate,
    l2DepositRate,
    l3DepositRate,
    l1RoiRate,
    l2RoiRate,
    l3RoiRate,
  ] = await Promise.all([
    getSetting("referral_l1_deposit_rate", "5"),
    getSetting("referral_l2_deposit_rate", "3"),
    getSetting("referral_l3_deposit_rate", "1"),
    getSetting("referral_l1_roi_rate", "5"),
    getSetting("referral_l2_roi_rate", "3"),
    getSetting("referral_l3_roi_rate", "1"),
  ]);

  res.json({
    code: user.referralCode,
    totalReferrals: total,
    activeReferrals,
    totalEarned,
    pendingEarnings,
    commissionRate: parseFloat(l1DepositRate) / 100,
    tierLabel,
    nextTierAt,
    levels: [
      { level: 1, depositRate: parseFloat(l1DepositRate), roiRate: parseFloat(l1RoiRate) },
      { level: 2, depositRate: parseFloat(l2DepositRate), roiRate: parseFloat(l2RoiRate) },
      { level: 3, depositRate: parseFloat(l3DepositRate), roiRate: parseFloat(l3RoiRate) },
    ],
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
