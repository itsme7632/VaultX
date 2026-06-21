import { eq, and, count, sql } from "drizzle-orm";
import {
  db,
  userInvestmentsTable,
  investmentPlansTable,
  walletsTable,
  transactionsTable,
  notificationsTable,
  referralsTable,
  usersTable,
  platformSettingsTable,
} from "@workspace/db";
import { logger } from "./logger";
import { generateTxId } from "./generate-tx-id";

function randomRoi(minRate: number, maxRate: number): number {
  return minRate + Math.random() * (maxRate - minRate);
}

async function getSetting(key: string, fallback: string): Promise<string> {
  const [s] = await db.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, key)).limit(1);
  return s?.value ?? fallback;
}

export async function processAllInvestments(force = false): Promise<{ processed: number; matured: number; skipped: number }> {
  const now = new Date();

  // Bulk auto-expire plans whose end_date has passed
  await db.execute(
    sql`UPDATE investment_plans
        SET status = 'expired', is_active = false
        WHERE end_date IS NOT NULL
          AND end_date < ${now.toISOString()}
          AND status NOT IN ('expired', 'closed')`
  );

  // Bulk auto fully_allocated when current_funding >= funding_goal
  await db.execute(
    sql`UPDATE investment_plans
        SET status = 'fully_allocated'
        WHERE funding_goal IS NOT NULL
          AND CAST(current_funding AS numeric) >= CAST(funding_goal AS numeric)
          AND status NOT IN ('expired', 'closed', 'fully_allocated')`
  );

  const activeInvestments = await db
    .select({
      inv: userInvestmentsTable,
      plan: investmentPlansTable,
    })
    .from(userInvestmentsTable)
    .leftJoin(investmentPlansTable, eq(userInvestmentsTable.planId, investmentPlansTable.id))
    .where(eq(userInvestmentsTable.status, "active"));

  let processed = 0;
  let matured = 0;
  let skipped = 0;

  for (const { inv, plan } of activeInvestments) {
    if (!plan) continue;

    const lastEarning = inv.lastEarningAt ? new Date(inv.lastEarningAt) : new Date(inv.startDate);
    const msSinceLast = now.getTime() - lastEarning.getTime();
    const hoursSinceLast = msSinceLast / (1000 * 60 * 60);

    if (!force && hoursSinceLast < 23.5) { skipped++; continue; }

    const endDate = new Date(inv.endDate);
    if (now > endDate) {
      if (inv.status === "active") {
        await db
          .update(userInvestmentsTable)
          .set({ status: "completed", updatedAt: now })
          .where(eq(userInvestmentsTable.id, inv.id));

        await db.insert(notificationsTable).values({
          userId: inv.userId,
          type: "investment",
          title: "Investment Matured",
          message: `Your ${plan.name} investment has matured. Total earned: ${parseFloat(inv.totalEarned).toFixed(2)} USDT.`,
        });
        matured++;
      }
      continue;
    }

    const planEndDate = (plan as any).endDate ? new Date((plan as any).endDate) : null;
    if (planEndDate && now > planEndDate) {
      if ((plan as any).status !== "expired" && (plan as any).status !== "closed") {
        await db
          .update(investmentPlansTable)
          .set({ status: "expired", isActive: false } as any)
          .where(eq(investmentPlansTable.id, plan.id));
      }
      if (inv.status === "active") {
        await db
          .update(userInvestmentsTable)
          .set({ status: "completed", updatedAt: now })
          .where(eq(userInvestmentsTable.id, inv.id));

        await db.insert(notificationsTable).values({
          userId: inv.userId,
          type: "investment",
          title: "Investment Closed — Opportunity Expired",
          message: `The ${plan.name} opportunity has closed. Your investment has been completed with a total earnings of ${parseFloat(inv.totalEarned).toFixed(2)} USDT.`,
        });
        matured++;
      }
      continue;
    }

    const minRate = parseFloat(plan.minRoiRate ?? "0.025");
    const maxRate = parseFloat(plan.maxRoiRate ?? "0.030");
    const dailyRate = randomRoi(minRate, maxRate);

    const principal = parseFloat(inv.amount);
    const earning = principal * dailyRate;

    if (earning <= 0) continue;

    const newPendingEarnings = parseFloat(inv.pendingEarnings) + earning;
    const newTotalEarned = parseFloat(inv.totalEarned) + earning;

    if (inv.autoCompound) {
      const newAmount = principal + earning;
      await db
        .update(userInvestmentsTable)
        .set({
          amount: newAmount.toFixed(8),
          totalEarned: newTotalEarned.toFixed(8),
          lastEarningAt: now,
          updatedAt: now,
        })
        .where(eq(userInvestmentsTable.id, inv.id));

      await db.insert(transactionsTable).values({
        userId: inv.userId,
        type: "reinvest",
        amount: earning.toFixed(8),
        status: "completed",
        txId: generateTxId(),
        note: `Auto-reinvested ROI ${(dailyRate * 100).toFixed(2)}% from ${plan.name}`,
      });
    } else {
      await db
        .update(userInvestmentsTable)
        .set({
          pendingEarnings: newPendingEarnings.toFixed(8),
          totalEarned: newTotalEarned.toFixed(8),
          lastEarningAt: now,
          updatedAt: now,
        })
        .where(eq(userInvestmentsTable.id, inv.id));
    }

    await db.insert(notificationsTable).values({
      userId: inv.userId,
      type: "earning",
      title: "Daily Profit Ready! 💰",
      message: `+${earning.toFixed(2)} USDT added to your ${plan.name} plan. Visit Portfolio to claim to wallet or reinvest to earn more.`,
    });

    await processReferralCommission(inv.userId, earning, plan.name);

    processed++;
  }

  logger.info({ processed, matured, skipped }, "ROI cron: cycle complete");
  return { processed, matured, skipped };
}

async function creditReferralCommission(
  referrerId: number,
  amount: number,
  level: number,
  sourceUsername: string,
  planName: string,
  ratePercent: number
): Promise<void> {
  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, referrerId)).limit(1);
  if (!wallet) return;

  await db.update(walletsTable).set({
    referralPendingEarnings: sql`referral_pending_earnings + ${amount.toFixed(8)}`,
  }).where(eq(walletsTable.userId, referrerId));

  await db.insert(transactionsTable).values({
    userId: referrerId,
    type: "referral",
    amount: amount.toFixed(8),
    status: "completed",
    txId: generateTxId(),
    note: `L${level} referral commission (${ratePercent.toFixed(1)}%) from ${planName} earnings`,
  });

  await db.insert(notificationsTable).values({
    userId: referrerId,
    type: "referral",
    title: `L${level} Referral Commission`,
    message: `+${amount.toFixed(4)} USDT commission (${ratePercent.toFixed(1)}%) from your referral's ${planName} earnings.`,
  });
}

async function processReferralCommission(userId: number, earning: number, planName: string): Promise<void> {
  const l1RateRaw = parseFloat(await getSetting("referral_l1_roi_rate", "5"));
  const l2RateRaw = parseFloat(await getSetting("referral_l2_roi_rate", "3"));
  const l3RateRaw = parseFloat(await getSetting("referral_l3_roi_rate", "1"));

  const l1Rate = l1RateRaw / 100;
  const l2Rate = l2RateRaw / 100;
  const l3Rate = l3RateRaw / 100;

  const [user] = await db.select({ referredBy: usersTable.referredBy, username: usersTable.username })
    .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user?.referredBy) return;

  const l1Id = user.referredBy;
  const l1Commission = earning * l1Rate;
  if (l1Commission >= 0.0001) {
    await creditReferralCommission(l1Id, l1Commission, 1, user.username ?? "user", planName, l1RateRaw);
    await db.update(referralsTable).set({
      commissionAmount: sql`commission_amount + ${l1Commission.toFixed(8)}`,
      status: "paid",
    }).where(and(eq(referralsTable.referrerId, l1Id), eq(referralsTable.referredId, userId)));
  }

  if (l2Rate <= 0) return;
  const [l1User] = await db.select({ referredBy: usersTable.referredBy, username: usersTable.username })
    .from(usersTable).where(eq(usersTable.id, l1Id)).limit(1);
  if (!l1User?.referredBy) return;

  const l2Id = l1User.referredBy;
  const l2Commission = earning * l2Rate;
  if (l2Commission >= 0.0001) {
    await creditReferralCommission(l2Id, l2Commission, 2, user.username ?? "user", planName, l2RateRaw);
  }

  if (l3Rate <= 0) return;
  const [l2User] = await db.select({ referredBy: usersTable.referredBy })
    .from(usersTable).where(eq(usersTable.id, l2Id)).limit(1);
  if (!l2User?.referredBy) return;

  const l3Id = l2User.referredBy;
  const l3Commission = earning * l3Rate;
  if (l3Commission >= 0.0001) {
    await creditReferralCommission(l3Id, l3Commission, 3, user.username ?? "user", planName, l3RateRaw);
  }
}
