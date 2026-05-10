import { Router, type IRouter } from "express";
import { eq, desc, count, sum } from "drizzle-orm";
import { db, usersTable, referralsTable, walletsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

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

  const referrals = await db
    .select()
    .from(referralsTable)
    .where(eq(referralsTable.referrerId, req.session.userId!));

  const totalEarned = referrals.reduce(
    (acc, r) => acc + parseFloat(r.commissionAmount),
    0
  );
  const activeReferrals = referrals.filter((r) => r.status === "active").length;
  const total = referrals.length;
  const currentTier = getTier(total);
  const nextTierAt = getNextTier(total);

  res.json({
    code: user.referralCode,
    totalReferrals: total,
    activeReferrals,
    totalEarned,
    pendingEarnings: 0,
    commissionRate: currentTier.rate,
    tierLabel: currentTier.label,
    nextTierAt,
    tiers: TIERS.map((t) => ({ ...t })),
  });
});

router.get("/referrals/history", requireAuth, async (req, res): Promise<void> => {
  const referrals = await db
    .select({
      ref: referralsTable,
      username: usersTable.username,
    })
    .from(referralsTable)
    .leftJoin(usersTable, eq(referralsTable.referredId, usersTable.id))
    .where(eq(referralsTable.referrerId, req.session.userId!))
    .orderBy(desc(referralsTable.createdAt));

  res.json(
    referrals.map((row) => ({
      id: row.ref.id,
      referredUsername: row.username ?? "Unknown",
      amount: parseFloat(row.ref.commissionAmount),
      status: row.ref.status,
      createdAt: row.ref.createdAt,
    }))
  );
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
