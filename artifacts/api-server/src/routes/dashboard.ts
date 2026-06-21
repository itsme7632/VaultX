import { Router, type IRouter } from "express";
import { eq, and, desc, gte, lte, inArray, sum, count, or, sql } from "drizzle-orm";
import {
  db,
  walletsTable,
  userInvestmentsTable,
  transactionsTable,
  referralsTable,
  usersTable,
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

router.get("/platform/performance", requireAuth, async (req, res): Promise<void> => {
  const year = new Date().getFullYear();
  const yearStart = new Date(`${year}-01-01T00:00:00.000Z`);
  const yearEnd = new Date(`${year + 1}-01-01T00:00:00.000Z`);

  const [
    depositsRes,
    earningsRes,
    activeInvRes,
    participantsRes,
    monthlyDepositsRes,
    monthlyEarningsRes,
  ] = await Promise.all([
    db.select({ s: sum(transactionsTable.amount) })
      .from(transactionsTable)
      .where(and(eq(transactionsTable.type, "deposit"), eq(transactionsTable.status, "completed"))),

    db.select({ s: sum(transactionsTable.amount) })
      .from(transactionsTable)
      .where(and(
        or(eq(transactionsTable.type, "earning"), eq(transactionsTable.type, "reinvest")),
        eq(transactionsTable.status, "completed")
      )),

    db.select({ s: sum(userInvestmentsTable.amount) })
      .from(userInvestmentsTable)
      .where(eq(userInvestmentsTable.status, "active")),

    db.select({ c: sql<number>`count(distinct ${userInvestmentsTable.userId})` })
      .from(userInvestmentsTable),

    db.select({
      month: sql<number>`extract(month from ${transactionsTable.createdAt})`,
      total: sum(transactionsTable.amount),
    })
      .from(transactionsTable)
      .where(and(
        eq(transactionsTable.type, "deposit"),
        eq(transactionsTable.status, "completed"),
        gte(transactionsTable.createdAt, yearStart),
        lte(transactionsTable.createdAt, yearEnd),
      ))
      .groupBy(sql`extract(month from ${transactionsTable.createdAt})`),

    db.select({
      month: sql<number>`extract(month from ${transactionsTable.createdAt})`,
      total: sum(transactionsTable.amount),
    })
      .from(transactionsTable)
      .where(and(
        or(eq(transactionsTable.type, "earning"), eq(transactionsTable.type, "reinvest")),
        eq(transactionsTable.status, "completed"),
        gte(transactionsTable.createdAt, yearStart),
        lte(transactionsTable.createdAt, yearEnd),
      ))
      .groupBy(sql`extract(month from ${transactionsTable.createdAt})`),
  ]);

  const toMonthlyArray = (rows: { month: number; total: string | null }[]) => {
    const arr = new Array(12).fill(0);
    for (const r of rows) {
      const idx = Math.round(Number(r.month)) - 1;
      if (idx >= 0 && idx < 12) arr[idx] = parseFloat(r.total ?? "0");
    }
    return arr;
  };

  res.json({
    totalDeposits: parseFloat(depositsRes[0]?.s ?? "0"),
    totalEarningsPaid: parseFloat(earningsRes[0]?.s ?? "0"),
    activeInvestmentsValue: parseFloat(activeInvRes[0]?.s ?? "0"),
    totalParticipants: Number(participantsRes[0]?.c ?? 0),
    monthlyDeposits: toMonthlyArray(monthlyDepositsRes as any),
    monthlyEarnings: toMonthlyArray(monthlyEarningsRes as any),
  });
});

export default router;
