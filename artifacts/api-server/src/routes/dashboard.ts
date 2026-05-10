import { Router, type IRouter } from "express";
import { eq, and, desc, gte, lte, inArray } from "drizzle-orm";
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

export default router;
