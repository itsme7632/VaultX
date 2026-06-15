import { Router, type IRouter } from "express";
import { eq, and, desc, inArray } from "drizzle-orm";
import {
  db,
  investmentPlansTable,
  userInvestmentsTable,
  walletsTable,
  transactionsTable,
  notificationsTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { generateTxId } from "../lib/generate-tx-id";

const router: IRouter = Router();

function computeInvestmentView(
  inv: typeof userInvestmentsTable.$inferSelect,
  planName: string,
  planMinRoi?: string,
  planMaxRoi?: string,
) {
  const now = new Date();
  const start = new Date(inv.startDate);
  const end = new Date(inv.endDate);
  const totalDays = Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const elapsed = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  const daysRemaining = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const progressPercent = Math.min(100, Math.max(0, (elapsed / totalDays) * 100));
  const amount = parseFloat(inv.amount);
  const dailyRate = parseFloat(inv.dailyReturnRate);
  const minRoi = parseFloat(planMinRoi ?? "0.025");
  const maxRoi = parseFloat(planMaxRoi ?? "0.030");
  const projectedDailyMin = amount * minRoi;
  const projectedDailyMax = amount * maxRoi;
  const projectedTotalMin = projectedDailyMin * totalDays;
  const projectedTotalMax = projectedDailyMax * totalDays;

  const lastRef = inv.lastEarningAt ? new Date(inv.lastEarningAt) : start;
  const nextPayoutAt = new Date(lastRef.getTime() + 24 * 60 * 60 * 1000);

  return {
    id: inv.id,
    planId: inv.planId,
    planName,
    amount,
    pendingEarnings: parseFloat(inv.pendingEarnings),
    totalEarned: parseFloat(inv.totalEarned),
    dailyReturnRate: dailyRate,
    minRoiRate: minRoi,
    maxRoiRate: maxRoi,
    autoCompound: inv.autoCompound,
    startDate: inv.startDate,
    endDate: inv.endDate,
    lastEarningAt: inv.lastEarningAt ?? null,
    nextPayoutAt: nextPayoutAt.toISOString(),
    status: inv.status,
    daysRemaining,
    daysTotal: Math.round(totalDays),
    progressPercent: parseFloat(progressPercent.toFixed(2)),
    projectedDailyMin: parseFloat(projectedDailyMin.toFixed(2)),
    projectedDailyMax: parseFloat(projectedDailyMax.toFixed(2)),
    projectedTotalMin: parseFloat(projectedTotalMin.toFixed(2)),
    projectedTotalMax: parseFloat(projectedTotalMax.toFixed(2)),
  };
}

router.get("/investments/plans", async (_req, res): Promise<void> => {
  const plans = await db
    .select()
    .from(investmentPlansTable)
    .where(eq(investmentPlansTable.isActive, true))
    .orderBy(investmentPlansTable.id);

  res.json(
    plans.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      minAmount: parseFloat(p.minAmount),
      maxAmount: parseFloat(p.maxAmount),
      dailyReturnRate: parseFloat(p.dailyReturnRate),
      minRoiRate: parseFloat(p.minRoiRate ?? "0.025"),
      maxRoiRate: parseFloat(p.maxRoiRate ?? "0.030"),
      durationDays: p.durationDays,
      riskLevel: p.riskLevel,
      features: p.features ?? [],
      isFeatured: p.isFeatured,
      isActive: p.isActive,
    })),
  );
});

router.get("/investments", requireAuth, async (req, res): Promise<void> => {
  const investments = await db
    .select({
      inv: userInvestmentsTable,
      planName: investmentPlansTable.name,
      planMinRoi: investmentPlansTable.minRoiRate,
      planMaxRoi: investmentPlansTable.maxRoiRate,
    })
    .from(userInvestmentsTable)
    .leftJoin(investmentPlansTable, eq(userInvestmentsTable.planId, investmentPlansTable.id))
    .where(eq(userInvestmentsTable.userId, req.session.userId!))
    .orderBy(desc(userInvestmentsTable.createdAt));

  res.json(
    investments.map((row) =>
      computeInvestmentView(
        row.inv,
        row.planName ?? "Unknown Plan",
        row.planMinRoi ?? undefined,
        row.planMaxRoi ?? undefined,
      ),
    ),
  );
});

router.post("/investments", requireAuth, async (req, res): Promise<void> => {
  const { planId, amount } = req.body;

  if (!planId || !amount || amount <= 0) {
    res.status(400).json({ error: "Invalid input", message: "Plan and valid amount required" });
    return;
  }

  const [plan] = await db
    .select()
    .from(investmentPlansTable)
    .where(and(eq(investmentPlansTable.id, planId), eq(investmentPlansTable.isActive, true)))
    .limit(1);

  if (!plan) {
    res.status(404).json({ error: "Plan not found", message: "Investment plan not found" });
    return;
  }

  const minAmount = parseFloat(plan.minAmount);
  const maxAmount = parseFloat(plan.maxAmount);

  if (amount < minAmount || amount > maxAmount) {
    res.status(400).json({
      error: "Amount out of range",
      message: `Amount must be between ${minAmount} and ${maxAmount} USDT`,
    });
    return;
  }

  const [wallet] = await db
    .select()
    .from(walletsTable)
    .where(eq(walletsTable.userId, req.session.userId!))
    .limit(1);

  if (!wallet || parseFloat(wallet.balance) < amount) {
    res.status(400).json({ error: "Insufficient balance", message: "Insufficient wallet balance" });
    return;
  }

  const endDate = new Date();
  endDate.setDate(endDate.getDate() + plan.durationDays);

  const midRoi =
    (parseFloat(plan.minRoiRate ?? "0.025") + parseFloat(plan.maxRoiRate ?? "0.030")) / 2;

  const [investment] = await db
    .insert(userInvestmentsTable)
    .values({
      userId: req.session.userId!,
      planId: plan.id,
      amount: amount.toString(),
      dailyReturnRate: midRoi.toFixed(6),
      endDate,
      status: "active",
    })
    .returning();

  await db
    .update(walletsTable)
    .set({ balance: (parseFloat(wallet.balance) - amount).toFixed(8) })
    .where(eq(walletsTable.userId, req.session.userId!));

  await db.insert(transactionsTable).values({
    userId: req.session.userId!,
    type: "investment",
    amount: amount.toString(),
    status: "completed",
    txId: generateTxId(),
    note: `Invested ${amount} USDT in ${plan.name}`,
  });

  await db.insert(notificationsTable).values({
    userId: req.session.userId!,
    type: "investment",
    title: "Investment Started",
    message: `Your ${amount} USDT investment in ${plan.name} is now active. Daily ROI: ${(midRoi * 100).toFixed(2)}% — profits will be ready in 24 hours.`,
  });

  res.status(201).json(
    computeInvestmentView(investment, plan.name, plan.minRoiRate ?? undefined, plan.maxRoiRate ?? undefined),
  );
});

router.post("/investments/:id/claim", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [investment] = await db
    .select()
    .from(userInvestmentsTable)
    .where(and(eq(userInvestmentsTable.id, id), eq(userInvestmentsTable.userId, req.session.userId!)))
    .limit(1);

  if (!investment) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const pending = parseFloat(investment.pendingEarnings);
  if (pending <= 0) {
    res.status(400).json({ error: "No earnings", message: "No pending earnings to claim" });
    return;
  }

  // Only clear pendingEarnings — totalEarned is already updated by the ROI engine
  await db
    .update(userInvestmentsTable)
    .set({ pendingEarnings: "0" })
    .where(eq(userInvestmentsTable.id, id));

  const [wallet] = await db
    .select()
    .from(walletsTable)
    .where(eq(walletsTable.userId, req.session.userId!))
    .limit(1);

  const newBalance = parseFloat(wallet.balance) + pending;
  const newTotalEarnings = parseFloat(wallet.totalEarnings) + pending;

  await db
    .update(walletsTable)
    .set({
      balance: newBalance.toFixed(8),
      totalEarnings: newTotalEarnings.toFixed(8),
    })
    .where(eq(walletsTable.userId, req.session.userId!));

  await db.insert(transactionsTable).values({
    userId: req.session.userId!,
    type: "earning",
    amount: pending.toFixed(8),
    status: "completed",
    txId: generateTxId(),
    note: `Earnings claimed from investment #${id}`,
  });

  res.json({ amountClaimed: pending, newBalance });
});

router.post("/investments/:id/reinvest", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [result] = await db
    .select({
      inv: userInvestmentsTable,
      planName: investmentPlansTable.name,
      planMinRoi: investmentPlansTable.minRoiRate,
      planMaxRoi: investmentPlansTable.maxRoiRate,
    })
    .from(userInvestmentsTable)
    .leftJoin(investmentPlansTable, eq(userInvestmentsTable.planId, investmentPlansTable.id))
    .where(and(eq(userInvestmentsTable.id, id), eq(userInvestmentsTable.userId, req.session.userId!)))
    .limit(1);

  if (!result) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const pending = parseFloat(result.inv.pendingEarnings);
  if (pending <= 0) {
    res.status(400).json({ error: "No earnings", message: "No pending earnings to reinvest" });
    return;
  }

  const newAmount = parseFloat(result.inv.amount) + pending;

  // Only update amount and clear pendingEarnings — totalEarned already tracked by ROI engine
  const [updated] = await db
    .update(userInvestmentsTable)
    .set({
      amount: newAmount.toFixed(8),
      pendingEarnings: "0",
    })
    .where(eq(userInvestmentsTable.id, id))
    .returning();

  await db.insert(transactionsTable).values({
    userId: req.session.userId!,
    type: "reinvest",
    amount: pending.toFixed(8),
    status: "completed",
    txId: generateTxId(),
    note: `Reinvested ${pending.toFixed(2)} USDT into ${result.planName ?? "investment"} #${id}`,
  });


  res.json(
    computeInvestmentView(
      updated,
      result.planName ?? "Plan",
      result.planMinRoi ?? undefined,
      result.planMaxRoi ?? undefined,
    ),
  );
});

router.post("/investments/:id/compound", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [result] = await db
    .select({
      inv: userInvestmentsTable,
      planName: investmentPlansTable.name,
      planMinRoi: investmentPlansTable.minRoiRate,
      planMaxRoi: investmentPlansTable.maxRoiRate,
    })
    .from(userInvestmentsTable)
    .leftJoin(investmentPlansTable, eq(userInvestmentsTable.planId, investmentPlansTable.id))
    .where(and(eq(userInvestmentsTable.id, id), eq(userInvestmentsTable.userId, req.session.userId!)))
    .limit(1);

  if (!result) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const pending = parseFloat(result.inv.pendingEarnings);
  if (pending <= 0) {
    res.status(400).json({ error: "No earnings", message: "No pending earnings to compound" });
    return;
  }

  const newAmount = parseFloat(result.inv.amount) + pending;

  // Only update amount, clear pending — totalEarned already tracked by ROI engine
  const [updated] = await db
    .update(userInvestmentsTable)
    .set({ amount: newAmount.toFixed(8), pendingEarnings: "0" })
    .where(eq(userInvestmentsTable.id, id))
    .returning();

  res.json(
    computeInvestmentView(
      updated,
      result.planName ?? "Plan",
      result.planMinRoi ?? undefined,
      result.planMaxRoi ?? undefined,
    ),
  );
});

router.get("/investments/earnings-history", requireAuth, async (req, res): Promise<void> => {
  const { limit = "90" } = req.query as { limit?: string };
  const userId = req.session.userId!;

  const txs = await db
    .select()
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.userId, userId),
        inArray(transactionsTable.type, ["earning", "reinvest"]),
        eq(transactionsTable.status, "completed"),
      )
    )
    .orderBy(desc(transactionsTable.createdAt))
    .limit(parseInt(limit, 10));

  res.json(
    txs.map((t) => ({
      id: t.id,
      type: t.type,
      amount: parseFloat(t.amount),
      note: t.note,
      createdAt: t.createdAt,
    }))
  );
});

router.post("/investments/:id/toggle-compound", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [result] = await db
    .select({
      inv: userInvestmentsTable,
      planName: investmentPlansTable.name,
      planMinRoi: investmentPlansTable.minRoiRate,
      planMaxRoi: investmentPlansTable.maxRoiRate,
    })
    .from(userInvestmentsTable)
    .leftJoin(investmentPlansTable, eq(userInvestmentsTable.planId, investmentPlansTable.id))
    .where(and(eq(userInvestmentsTable.id, id), eq(userInvestmentsTable.userId, req.session.userId!)))
    .limit(1);

  if (!result) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const [updated] = await db
    .update(userInvestmentsTable)
    .set({ autoCompound: !result.inv.autoCompound })
    .where(eq(userInvestmentsTable.id, id))
    .returning();

  res.json(
    computeInvestmentView(
      updated,
      result.planName ?? "Plan",
      result.planMinRoi ?? undefined,
      result.planMaxRoi ?? undefined,
    ),
  );
});

export default router;
