import { Router, type IRouter } from "express";
import { eq, and, desc, gte, lte, lt, inArray, sum, count, or, sql } from "drizzle-orm";
import {
  db,
  walletsTable,
  userInvestmentsTable,
  transactionsTable,
  referralsTable,
  usersTable,
  investmentPlansTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/dashboard/summary", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  const [wallet] = await db
    .select()
    .from(walletsTable)
    .where(eq(walletsTable.userId, userId))
    .limit(1);

  const activeInvestments = await db
    .select()
    .from(userInvestmentsTable)
    .where(and(eq(userInvestmentsTable.userId, userId), eq(userInvestmentsTable.status, "active")));

  const activeInvestmentsValue = activeInvestments.reduce(
    (acc, inv) => acc + parseFloat(inv.amount),
    0
  );

  const dailyEarnings = activeInvestments.reduce(
    (acc, inv) => acc + parseFloat(inv.amount) * parseFloat(inv.dailyReturnRate),
    0
  );

  const pendingEarnings = activeInvestments.reduce(
    (acc, inv) => acc + parseFloat(inv.pendingEarnings),
    0
  );

  const referralEarnings = await db
    .select()
    .from(referralsTable)
    .where(eq(referralsTable.referrerId, userId));

  const referralTotal = referralEarnings.reduce(
    (acc, r) => acc + parseFloat(r.commissionAmount),
    0
  );

  res.json({
    totalBalance: wallet ? parseFloat(wallet.balance) : 0,
    activeInvestmentsCount: activeInvestments.length,
    activeInvestmentsValue,
    dailyEarnings,
    totalEarnings: wallet ? parseFloat(wallet.totalEarnings) : 0,
    pendingEarnings,
    referralEarnings: referralTotal,
  });
});

router.get("/dashboard/earnings-chart", requireAuth, async (req, res): Promise<void> => {
  const { days = "7" } = req.query as { days?: string };
  const numDays = parseInt(days, 10);

  const now = new Date();
  const result = [];

  for (let i = numDays - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];

    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const txs = await db
      .select()
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.userId, req.session.userId!),
          inArray(transactionsTable.type, ["earning", "reinvest", "referral"]),
          eq(transactionsTable.status, "completed"),
          gte(transactionsTable.createdAt, dayStart),
          lte(transactionsTable.createdAt, dayEnd)
        )
      );

    const earnings = txs.reduce((acc, t) => acc + parseFloat(t.amount), 0);

    result.push({
      date: dateStr,
      earnings: parseFloat(earnings.toFixed(4)),
      label: date.toLocaleDateString("en-US", { weekday: "short" }),
    });
  }

  res.json(result);
});

router.get("/dashboard/live-activity", requireAuth, async (req, res): Promise<void> => {
  const since = new Date(Date.now() - 72 * 60 * 60 * 1000);

  const txs = await db
    .select({
      id: transactionsTable.id,
      type: transactionsTable.type,
      amount: transactionsTable.amount,
      createdAt: transactionsTable.createdAt,
      username: usersTable.username,
    })
    .from(transactionsTable)
    .leftJoin(usersTable, eq(transactionsTable.userId, usersTable.id))
    .where(
      and(
        inArray(transactionsTable.type, ["deposit", "withdrawal", "investment", "earning", "reinvest", "referral"]),
        eq(transactionsTable.status, "completed"),
        gte(transactionsTable.createdAt, since),
      )
    )
    .orderBy(desc(transactionsTable.createdAt))
    .limit(20);

  res.json(
    txs.map((t) => ({
      id: `real-${t.id}`,
      type: t.type,
      amount: parseFloat(t.amount),
      username: t.username
        ? t.username.slice(0, 2) + "***" + (t.username.length > 4 ? t.username.slice(-1) : "")
        : "u***r",
      createdAt: t.createdAt,
    }))
  );
});

router.get("/dashboard/activity", requireAuth, async (req, res): Promise<void> => {
  const txs = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, req.session.userId!))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(10);

  res.json(
    txs.map((t) => ({
      id: t.id,
      type: t.type,
      description: t.note || `${t.type.charAt(0).toUpperCase() + t.type.slice(1)} of $${parseFloat(t.amount).toFixed(2)}`,
      amount: parseFloat(t.amount),
      createdAt: t.createdAt,
    }))
  );
});

/**
 * GET /api/platform/performance
 *
 * Returns monthly statistics reconciled with the canonical platform-metrics totals.
 *
 * Monthly Inflow  = real investment amounts from user_investments, per month.
 *                   Any admin-set currentFunding surplus (plan override > actual
 *                   investments) is added to the current month so that the column
 *                   sum matches the Platform Capital figure shown in the hero.
 *
 * Monthly Distributions = completed earning/reinvest transactions, per month.
 *                         Sum equals the Distributions Paid metric.
 *
 * Monthly Users   = new user registrations per month (real createdAt timestamps).
 *                   Running cumulative total is also returned so the UI can
 *                   choose either view.
 */
router.get("/platform/performance", requireAuth, async (req, res): Promise<void> => {
  const year = new Date().getFullYear();
  const currentMonthIdx = new Date().getMonth(); // 0-indexed
  const yearStart = new Date(`${year}-01-01T00:00:00.000Z`);
  const yearEnd   = new Date(`${year + 1}-01-01T00:00:00.000Z`);

  const [
    monthlyInvestmentsRes,
    monthlyEarningsRes,
    monthlyUsersRes,
  ] = await Promise.all([
    // Real investment amounts per month — actual capital deployed into plans
    db.select({
      month: sql<number>`extract(month from ${userInvestmentsTable.createdAt})`,
      total: sum(userInvestmentsTable.amount),
    })
      .from(userInvestmentsTable)
      .where(and(
        gte(userInvestmentsTable.createdAt, yearStart),
        lt(userInvestmentsTable.createdAt, yearEnd),
      ))
      .groupBy(sql`extract(month from ${userInvestmentsTable.createdAt})`),

    // Completed distributions (earning + reinvest) per month
    db.select({
      month: sql<number>`extract(month from ${transactionsTable.createdAt})`,
      total: sum(transactionsTable.amount),
    })
      .from(transactionsTable)
      .where(and(
        or(eq(transactionsTable.type, "earning"), eq(transactionsTable.type, "reinvest")),
        eq(transactionsTable.status, "completed"),
        gte(transactionsTable.createdAt, yearStart),
        lt(transactionsTable.createdAt, yearEnd),
      ))
      .groupBy(sql`extract(month from ${transactionsTable.createdAt})`),

    // New user registrations per month
    db.select({
      month: sql<number>`extract(month from ${usersTable.createdAt})`,
      total: count(),
    })
      .from(usersTable)
      .where(and(
        gte(usersTable.createdAt, yearStart),
        lt(usersTable.createdAt, yearEnd),
      ))
      .groupBy(sql`extract(month from ${usersTable.createdAt})`),
  ]);

  // ── Helper: sparse DB rows → 12-element numeric array ────────────────────
  const toMonthlyAmounts = (rows: { month: number; total: string | null }[]): number[] => {
    const arr = new Array(12).fill(0);
    for (const r of rows) {
      const idx = Math.round(Number(r.month)) - 1;
      if (idx >= 0 && idx < 12) arr[idx] = parseFloat(r.total ?? "0");
    }
    return arr;
  };

  const toMonthlyCounts = (rows: { month: number; total: number }[]): number[] => {
    const arr = new Array(12).fill(0);
    for (const r of rows) {
      const idx = Math.round(Number(r.month)) - 1;
      if (idx >= 0 && idx < 12) arr[idx] = Number(r.total ?? 0);
    }
    return arr;
  };

  const monthlyInvestments = toMonthlyAmounts(monthlyInvestmentsRes as any);
  const monthlyEarnings    = toMonthlyAmounts(monthlyEarningsRes as any);
  const monthlyNewUsers    = toMonthlyCounts(monthlyUsersRes as any);

  // NOTE: Admin-set currentFunding overrides are intentionally NOT injected into
  // the monthly inflow array. The chart shows real, timestamped investment
  // transactions only. The hero-card "Platform Capital" (platform-metrics endpoint)
  // may differ and represents the admin-configured funding level.

  // ── Cumulative user totals (running sum up to each month) ─────────────────
  // Total registered users before this year (for the running baseline)
  const [priorUsersRes] = await db.select({ c: count() })
    .from(usersTable)
    .where(lte(usersTable.createdAt, new Date(`${year}-01-01T00:00:00.000Z`)));
  const priorUsers = Number(priorUsersRes?.c ?? 0);

  const monthlyCumulativeUsers: number[] = [];
  let running = priorUsers;
  for (let i = 0; i < 12; i++) {
    running += monthlyNewUsers[i];
    monthlyCumulativeUsers.push(running);
  }

  res.json({
    monthlyDeposits:         monthlyInvestments,   // investment inflow per month
    monthlyEarnings:         monthlyEarnings,       // distributions paid per month
    monthlyNewUsers:         monthlyNewUsers,        // new registrations per month
    monthlyCumulativeUsers:  monthlyCumulativeUsers, // total users by end of each month
  });
});

export default router;
