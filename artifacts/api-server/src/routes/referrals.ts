import { Router, type IRouter } from "express";
import { eq, desc, count, sum } from "drizzle-orm";
import { db, usersTable, referralsTable, walletsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const COMMISSION_RATE = 0.05;

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

  res.json({
    code: user.referralCode,
    totalReferrals: referrals.length,
    activeReferrals,
    totalEarned,
    pendingEarnings: 0,
    commissionRate: COMMISSION_RATE,
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
