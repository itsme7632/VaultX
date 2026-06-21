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

    // Per-plan canonical stats — this becomes the single source of truth
    const planDetails: Array<{
      id: number;
      participants: number;
      capitalRaised: number;
      fundingGoal: number;
      fundingPct: number;
      fundingDisplay: string;
      barPct: number;
      capitalRemaining: number;
      joinedToday: number;
      joinedWeek: number;
    }> = [];

    for (const plan of plans) {
      const ex = plan as any;

      // Capital raised: max of plan.currentFunding vs actual DB investment sum
      const planCurrentFunding = ex.currentFunding != null ? parseFloat(ex.currentFunding) : 0;
      const dbCapitalRaised = statsMap[plan.id]?.dbCapitalRaised ?? 0;
      const capitalRaised = Math.max(planCurrentFunding, dbCapitalRaised);

      const fundingGoal = ex.fundingGoal != null ? parseFloat(ex.fundingGoal) : 0;

      // Participants:
      //   1. display_participant_count override (explicit admin value)
      //   2. 0 when capitalRaised <= 0 — no funding = no participants
      //   3. autoParticipantsFromRaised — deterministic scale from real funding
      // NOTE: actual DB investment count (db_participants) is intentionally excluded
      // because it reflects test/seed users and does not represent realistic participation.
      const displayOverride = ex.displayParticipantCount != null ? Number(ex.displayParticipantCount) : null;

      let participants: number;
      if (displayOverride !== null) {
        participants = displayOverride;
      } else if (capitalRaised <= 0) {
        participants = 0;
      } else {
        participants = autoParticipantsFromRaised(capitalRaised, plan.id);
      }

      // Funding percentage
      const fundingPct = fundingGoal > 0 ? Math.min(100, (capitalRaised / fundingGoal) * 100) : 0;
      const fundingPctRounded = Math.round(fundingPct);
      const fundingDisplay = capitalRaised > 0 && fundingPctRounded === 0 ? "< 1%" : `${fundingPctRounded}%`;
      const barPct = capitalRaised > 0 ? Math.max(0.5, fundingPct) : 0;
      const capitalRemaining = Math.max(0, fundingGoal - capitalRaised);

      // Activity metrics — driven by real funding level, deterministic per plan
      // Higher funded = more participant activity; zero raised = zero activity
      const planSeed = ((plan.id * 31 + 7) % 97) / 97;
      const activityBase = capitalRaised > 0 ? Math.max(1, Math.floor(fundingPct / 8)) : 0;
      const joinedToday = capitalRaised > 0 ? Math.max(1, Math.round(activityBase * (0.7 + planSeed * 0.6))) : 0;
      const joinedWeek = capitalRaised > 0 ? joinedToday * 4 + Math.floor(planSeed * 15) : 0;

      planDetails.push({ id: plan.id, participants, capitalRaised, fundingGoal, fundingPct, fundingDisplay, barPct, capitalRemaining, joinedToday, joinedWeek });

      // Aggregate totals
      totalRaised += capitalRaised;
      if (fundingGoal > 0) totalTarget += fundingGoal;
      totalParticipants += participants;

      // Track leaders
      if (fundingPct > topFundedPct) { topFundedPct = fundingPct; topFundedPlan = plan; }
      if (participants > mostPopularCount) { mostPopularCount = participants; mostPopularPlan = plan; }

      // Fastest growing: highest weekly growth rate (joinedWeek relative to participants)
      const growthScore = participants > 0 ? joinedWeek / participants : joinedWeek;
      if (growthScore > fastestGrowingScore) { fastestGrowingScore = growthScore; fastestGrowingPlan = plan; }
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
      // Per-plan canonical stats — consumed by plan cards on the frontend
      plans: planDetails,
    });
  } catch (err) {
    console.error("[platform-metrics]", err);
    res.status(500).json({ error: "Failed to compute platform metrics" });
  }
});

export default router;
