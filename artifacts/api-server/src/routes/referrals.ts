import { Router, type IRouter } from "express";
import { eq, desc, count, sum, and, sql, gte } from "drizzle-orm";
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

// ─── Demo data (deterministic – never changes on refresh) ────────────────────

const DEMO_LEADERBOARD = [
  { username: "CryptoHunter",  referrals: 87, earned: 4250.00 },
  { username: "WexInvestor",   referrals: 64, earned: 3180.50 },
  { username: "DigitalTrader", referrals: 51, earned: 2520.75 },
  { username: "AlphaGrowth",   referrals: 43, earned: 2100.00 },
  { username: "FutureCapital", referrals: 38, earned: 1860.25 },
  { username: "BlockchainPro", referrals: 29, earned: 1410.00 },
  { username: "WealthBuilder", referrals: 24, earned: 1170.50 },
  { username: "TokenMaster",   referrals: 19, earned:  920.00 },
  { username: "CryptoKing",    referrals: 14, earned:  680.75 },
  { username: "InvestorPro",   referrals:  9, earned:  440.00 },
];

const DEMO_STATS = {
  communityReferrals: 1247,
  activeReferrers: 284,
  rewardsDistributed: 31580.50,
  weeklyGrowthPct: 12.4,
  monthlyGrowthPct: 18.7,
};

const DEMO_CHARTS = {
  daily:   [3, 7, 5, 12, 8, 15, 11],
  weekly:  [24, 38, 51, 67],
  monthly: [45, 78, 112, 149, 187, 234],
};

// ─── Helpers: bucket referral timestamps into chart arrays ───────────────────

function buildWeeklyChart(rows: { createdAt: Date | string }[]): number[] {
  const chart = [0, 0, 0, 0];
  const now = Date.now();
  for (const r of rows) {
    const msAgo = now - new Date(r.createdAt).getTime();
    const weekIndex = Math.floor(msAgo / (7 * 86_400_000));
    if (weekIndex >= 0 && weekIndex < 4) chart[3 - weekIndex]++;
  }
  return chart;
}

function buildMonthlyChart(rows: { createdAt: Date | string }[]): number[] {
  const chart = new Array<number>(6).fill(0);
  const now = new Date();
  for (const r of rows) {
    const d = new Date(r.createdAt);
    const monthDiff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    if (monthDiff >= 0 && monthDiff < 6) chart[5 - monthDiff]++;
  }
  return chart;
}

function growthPct(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

// ─── Community / hybrid stats endpoint ───────────────────────────────────────
// All 7 community widgets (cards, chart, sources, leaderboard) read exclusively
// from this single endpoint so they always share the same dataset.

router.get("/referrals/community", requireAuth, async (req, res): Promise<void> => {
  const mode = await getSetting("referral_hybrid_mode", "auto");

  // ── Real DB aggregates ──────────────────────────────────────────────────────
  const [totalRes, rewardsRes] = await Promise.all([
    db.select({ c: count() }).from(referralsTable),
    db.select({ s: sum(referralsTable.commissionAmount) }).from(referralsTable),
  ]);

  const realTotal   = Number(totalRes[0]?.c ?? 0);
  const realRewards = parseFloat(rewardsRes[0]?.s ?? "0");

  // ── Real leaderboard (exclude admin accounts) ───────────────────────────────
  const realLbRows = await db
    .select({
      referrerId:     referralsTable.referrerId,
      totalReferrals: count(referralsTable.id),
      totalEarned:    sum(referralsTable.commissionAmount),
      username:       usersTable.username,
      isAdmin:        usersTable.isAdmin,
    })
    .from(referralsTable)
    .leftJoin(usersTable, eq(referralsTable.referrerId, usersTable.id))
    .groupBy(referralsTable.referrerId, usersTable.username, usersTable.isAdmin)
    .orderBy(desc(count(referralsTable.id)))
    .limit(20);

  const realLbClean = realLbRows.filter((r) => !r.isAdmin);

  // ── Active referrers: unique users who made a referral in last 30 days ───────
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
  const activeReferrersRes = await db
    .select({ referrerId: referralsTable.referrerId })
    .from(referralsTable)
    .where(gte(referralsTable.createdAt, thirtyDaysAgo))
    .groupBy(referralsTable.referrerId);
  const realActiveReferrers = activeReferrersRes.length;

  // ── Daily chart – last 7 days ──────────────────────────────────────────────
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);
  const dailyRows = await db
    .select({
      day:   sql<string>`date_trunc('day', ${referralsTable.createdAt})`,
      total: count(),
    })
    .from(referralsTable)
    .where(gte(referralsTable.createdAt, sevenDaysAgo))
    .groupBy(sql`date_trunc('day', ${referralsTable.createdAt})`)
    .orderBy(sql`date_trunc('day', ${referralsTable.createdAt})`);

  const dailyMap: Record<string, number> = {};
  for (const r of dailyRows) {
    const d = new Date(r.day).toISOString().split("T")[0];
    dailyMap[d] = Number(r.total);
  }
  const realDailyChart: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().split("T")[0];
    realDailyChart.push(dailyMap[d] ?? 0);
  }

  // ── Weekly chart – last 28 days (4 × 7-day buckets) ───────────────────────
  const twentyEightDaysAgo = new Date(Date.now() - 28 * 86_400_000);
  const weeklyRawRows = await db
    .select({ createdAt: referralsTable.createdAt })
    .from(referralsTable)
    .where(gte(referralsTable.createdAt, twentyEightDaysAgo));
  const realWeeklyChart = buildWeeklyChart(weeklyRawRows);

  // ── Monthly chart – last 6 calendar months ─────────────────────────────────
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const monthlyRawRows = await db
    .select({ createdAt: referralsTable.createdAt })
    .from(referralsTable)
    .where(gte(referralsTable.createdAt, sixMonthsAgo));
  const realMonthlyChart = buildMonthlyChart(monthlyRawRows);

  // ── Real growth percentages ────────────────────────────────────────────────
  const realWeeklyGrowthPct  = growthPct(realWeeklyChart[3],  realWeeklyChart[2]);
  const realMonthlyGrowthPct = growthPct(realMonthlyChart[5], realMonthlyChart[4]);

  // ── Referral source breakdown ──────────────────────────────────────────────
  // referral_source column exists in schema (default: "direct").
  // Query real GROUP BY counts; calculate percentages; return empty array only
  // when there are truly no referrals so the frontend can fall back to demo.
  const sourceRows = await db
    .select({
      source: referralsTable.referralSource,
      total:  count(),
    })
    .from(referralsTable)
    .groupBy(referralsTable.referralSource)
    .orderBy(desc(count()));

  const sourceGrandTotal = sourceRows.reduce((acc, r) => acc + Number(r.total), 0);
  const referralSources: { source: string; count: number; pct: number }[] =
    sourceGrandTotal > 0
      ? sourceRows.map((r) => ({
          source: r.source ?? "direct",
          count:  Number(r.total),
          pct:    Math.round((Number(r.total) / sourceGrandTotal) * 100),
        }))
      : [];

  // ── Server-side audit consistency check ────────────────────────────────────
  if (mode !== "disabled") {
    const HYBRID_INFLATION_THRESHOLD = 50;
    if (realTotal > 0 && DEMO_STATS.communityReferrals / realTotal > HYBRID_INFLATION_THRESHOLD) {
      console.warn(
        `[Wexora Referral Audit] Hybrid mode: demo data (${DEMO_STATS.communityReferrals}) is ` +
        `${HYBRID_INFLATION_THRESHOLD}x+ larger than real referrals (${realTotal}). ` +
        `Consider switching to "disabled" mode once real data grows.`
      );
    }
  }

  const isDisabled  = mode === "disabled";
  const hasRealData = realTotal >= 5;

  if (isDisabled) {
    // Pure real data – no demo mixing
    res.json({
      communityReferrals: realTotal,
      activeReferrers:    realActiveReferrers,
      rewardsDistributed: realRewards,
      weeklyGrowthPct:    realWeeklyGrowthPct,
      monthlyGrowthPct:   realMonthlyGrowthPct,
      leaderboard: realLbClean.map((r, i) => ({
        rank: i + 1,
        username: r.username ?? "User",
        totalReferrals: r.totalReferrals,
        totalEarned:    parseFloat(r.totalEarned ?? "0"),
        isReal: true,
      })),
      dailyChart:      realDailyChart,
      weeklyChart:     realWeeklyChart,
      monthlyChart:    realMonthlyChart,
      referralSources,
      mode,
      isHybrid: false,
    });
    return;
  }

  // ── Hybrid / auto / full_demo ────────────────────────────────────────────
  const communityReferrals  = hasRealData ? realTotal + DEMO_STATS.communityReferrals : DEMO_STATS.communityReferrals;
  const activeReferrers     = hasRealData ? realActiveReferrers + DEMO_STATS.activeReferrers : DEMO_STATS.activeReferrers;
  const rewardsDistributed  = hasRealData ? realRewards + DEMO_STATS.rewardsDistributed : DEMO_STATS.rewardsDistributed;

  const weeklyGrowthPct  = hasRealData ? realWeeklyGrowthPct  : DEMO_STATS.weeklyGrowthPct;
  const monthlyGrowthPct = hasRealData ? realMonthlyGrowthPct : DEMO_STATS.monthlyGrowthPct;

  // Leaderboard: real users first, fill remainder with demo names
  const realEntries = realLbClean.map((r) => ({
    username:       r.username ?? "User",
    totalReferrals: r.totalReferrals,
    totalEarned:    parseFloat(r.totalEarned ?? "0"),
    isReal:         true,
  }));
  const usedNames = new Set(realEntries.map((e) => e.username));
  const demoFill  = DEMO_LEADERBOARD.filter((d) => !usedNames.has(d.username)).map((d) => ({
    username:       d.username,
    totalReferrals: d.referrals,
    totalEarned:    d.earned,
    isReal:         false,
  }));

  const leaderboard = [...realEntries, ...demoFill]
    .sort((a, b) => b.totalReferrals - a.totalReferrals)
    .slice(0, 10)
    .map((e, i) => ({ ...e, rank: i + 1 }));

  // Charts: prefer real if any activity exists, else demo
  const hasRealDaily   = realDailyChart.some((v) => v > 0);
  const hasRealWeekly  = realWeeklyChart.some((v) => v > 0);
  const hasRealMonthly = realMonthlyChart.some((v) => v > 0);

  res.json({
    communityReferrals,
    activeReferrers,
    rewardsDistributed,
    weeklyGrowthPct,
    monthlyGrowthPct,
    leaderboard,
    dailyChart:      hasRealDaily   ? realDailyChart   : DEMO_CHARTS.daily,
    weeklyChart:     hasRealWeekly  ? realWeeklyChart  : DEMO_CHARTS.weekly,
    monthlyChart:    hasRealMonthly ? realMonthlyChart : DEMO_CHARTS.monthly,
    referralSources,
    mode,
    isHybrid: true,
    realStats: {
      referrals:       realTotal,
      activeReferrers: realActiveReferrers,
      rewards:         realRewards,
    },
  });
});

// ─── Personal referral stats ──────────────────────────────────────────────────

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

// ─── Claim pending earnings ───────────────────────────────────────────────────

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

// ─── Per-referral history ─────────────────────────────────────────────────────

router.get("/referrals/history", requireAuth, async (req, res): Promise<void> => {
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

  const allTxs = await db
    .select()
    .from(transactionsTable)
    .where(and(eq(transactionsTable.userId, req.session.userId!), eq(transactionsTable.type, "referral"), eq(transactionsTable.status, "completed")))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(200);

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

  // Audit: log when transaction total diverges from referral commission total
  const txTotal  = txWithSource.reduce((a, t) => a + t.amount, 0);
  const refTotal = referrals.reduce((a, r) => a + parseFloat(r.ref.commissionAmount), 0);
  if (Math.abs(txTotal - refTotal) > 0.01) {
    console.warn(
      `[Wexora Referral Audit] User #${req.session.userId}: ` +
      `transaction total (${txTotal.toFixed(4)}) differs from referral commission total (${refTotal.toFixed(4)}). ` +
      `This may indicate pending commissions not yet reflected in transactions.`
    );
  }

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

// ─── Leaderboard (real only – community endpoint handles hybrid) ──────────────

router.get("/referrals/leaderboard", requireAuth, async (req, res): Promise<void> => {
  const result = await db
    .select({
      referrerId: referralsTable.referrerId,
      totalReferrals: count(referralsTable.id),
      totalEarned: sum(referralsTable.commissionAmount),
      username: usersTable.username,
      isAdmin: usersTable.isAdmin,
    })
    .from(referralsTable)
    .leftJoin(usersTable, eq(referralsTable.referrerId, usersTable.id))
    .groupBy(referralsTable.referrerId, usersTable.username, usersTable.isAdmin)
    .orderBy(desc(count(referralsTable.id)))
    .limit(20);

  res.json(
    result
      .filter((r) => !r.isAdmin)
      .map((row, index) => ({
        rank: index + 1,
        username: row.username ?? "Unknown",
        totalReferrals: row.totalReferrals,
        totalEarned: parseFloat(row.totalEarned ?? "0"),
      }))
  );
});

export default router;
