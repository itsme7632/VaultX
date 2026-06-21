import { Router, type IRouter } from "express";
import { eq, sum, count, and, or } from "drizzle-orm";
import {
  db,
  investmentPlansTable,
  userInvestmentsTable,
  transactionsTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function autoParticipantsFromRaised(raised: number, planId: number): number {
  if (raised <= 0) return 0;
  const frac = ((planId * 31 + 7) % 97) / 97;
  const points = [
    { r: 0,       min: 1,   max: 2 },
    { r: 2000,    min: 1,   max: 5 },
    { r: 100000,  min: 15,  max: 60 },
    { r: 500000,  min: 50,  max: 250 },
    { r: 2000000, min: 150, max: 1000 },
  ];
  for (let i = 1; i < points.length; i++) {
    if (raised <= points[i].r || i === points.length - 1) {
      const prev = points[i - 1], curr = points[i];
      const t = prev.r === curr.r ? 1 : Math.min(1, Math.max(0, (raised - prev.r) / (curr.r - prev.r)));
      const minV = prev.min + t * (curr.min - prev.min);
      const maxV = prev.max + t * (curr.max - prev.max);
      return Math.max(1, Math.floor(minV + frac * (maxV - minV)));
    }
  }
  return Math.floor(150 + frac * 850);
}

router.get("/platform-metrics", requireAuth, async (req, res): Promise<void> => {
  try {
    const [plans, planStats, activeInvRes, distributionsRes] = await Promise.all([
      db.select().from(investmentPlansTable).where(eq(investmentPlansTable.isActive, true)),

      db.select({
        planId: userInvestmentsTable.planId,
        totalParticipants: count(),
        capitalRaised: sum(userInvestmentsTable.amount),
      })
        .from(userInvestmentsTable)
        .where(eq(userInvestmentsTable.status, "active"))
        .groupBy(userInvestmentsTable.planId),

      db.select({ s: sum(userInvestmentsTable.amount) })
        .from(userInvestmentsTable)
        .where(eq(userInvestmentsTable.status, "active")),

      db.select({ s: sum(transactionsTable.amount) })
        .from(transactionsTable)
        .where(and(
          or(eq(transactionsTable.type, "earning"), eq(transactionsTable.type, "reinvest")),
          eq(transactionsTable.status, "completed"),
        )),
    ]);

    const statsMap: Record<number, { dbParticipants: number; dbCapitalRaised: number }> = {};
    for (const s of planStats) {
      statsMap[s.planId] = {
        dbParticipants: Number(s.totalParticipants ?? 0),
        dbCapitalRaised: parseFloat(s.capitalRaised ?? "0"),
      };
    }

    let totalRaised = 0;
    let totalTarget = 0;
    let totalParticipants = 0;

    let topFundedPlan: any = null;
    let topFundedPct = -1;
    let mostPopularPlan: any = null;
    let mostPopularCount = -1;
    let fastestGrowingPlan: any = null;
    let fastestGrowingScore = -1;

    for (const plan of plans) {
      const ex = plan as any;

      const planCurrentFunding = ex.currentFunding != null ? parseFloat(ex.currentFunding) : 0;
      const dbCapitalRaised = statsMap[plan.id]?.dbCapitalRaised ?? 0;
      const capitalRaised = Math.max(planCurrentFunding, dbCapitalRaised);

      const fundingGoal = ex.fundingGoal != null ? parseFloat(ex.fundingGoal) : null;

      const displayOverride = ex.displayParticipantCount != null ? Number(ex.displayParticipantCount) : null;
      const dbParticipants = statsMap[plan.id]?.dbParticipants ?? 0;

      let participants: number;
      if (displayOverride !== null) {
        participants = displayOverride;
      } else if (capitalRaised <= 0) {
        participants = 0;
      } else if (dbParticipants > 0) {
        participants = dbParticipants;
      } else {
        participants = autoParticipantsFromRaised(capitalRaised, plan.id);
      }

      totalRaised += capitalRaised;
      if (fundingGoal) totalTarget += fundingGoal;
      totalParticipants += participants;

      const fundingPct = fundingGoal && fundingGoal > 0 ? (capitalRaised / fundingGoal) * 100 : 0;
      if (fundingPct > topFundedPct) {
        topFundedPct = fundingPct;
        topFundedPlan = plan;
      }
      if (participants > mostPopularCount) {
        mostPopularCount = participants;
        mostPopularPlan = plan;
      }
      const growthScore = fundingPct + (capitalRaised > 0 ? Math.log10(capitalRaised + 1) * 5 : 0);
      if (growthScore > fastestGrowingScore) {
        fastestGrowingScore = growthScore;
        fastestGrowingPlan = plan;
      }
    }

    const activeInvestments = parseFloat(activeInvRes[0]?.s ?? "0");
    const distributionsPaid = parseFloat(distributionsRes[0]?.s ?? "0");
    const fundingPercentage = totalTarget > 0 ? Math.min(100, (totalRaised / totalTarget) * 100) : 0;

    res.json({
      totalRaised,
      totalTarget,
      fundingPercentage,
      totalParticipants,
      activeOpportunities: plans.length,
      capitalDeployed: totalRaised,
      activeInvestments,
      distributionsPaid,
      mostPopular: mostPopularPlan
        ? { id: mostPopularPlan.id, name: mostPopularPlan.name, participants: mostPopularCount }
        : null,
      topFunded: topFundedPlan
        ? { id: topFundedPlan.id, name: topFundedPlan.name, fundingPct: Math.round(topFundedPct * 10) / 10 }
        : null,
      fastestGrowing: fastestGrowingPlan
        ? { id: fastestGrowingPlan.id, name: fastestGrowingPlan.name }
        : null,
    });
  } catch (err) {
    console.error("[platform-metrics]", err);
    res.status(500).json({ error: "Failed to compute platform metrics" });
  }
});

export default router;
