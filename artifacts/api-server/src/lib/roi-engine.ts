import { eq, and, lte, count } from "drizzle-orm";
import {
  db,
  userInvestmentsTable,
  investmentPlansTable,
  walletsTable,
  transactionsTable,
  notificationsTable,
  referralsTable,
  usersTable,
} from "@workspace/db";
import { logger } from "./logger";
import { generateTxId } from "./generate-tx-id";

function randomRoi(minRate: number, maxRate: number): number {
  return minRate + Math.random() * (maxRate - minRate);
}

export async function processAllInvestments(force = false): Promise<{ processed: number; matured: number; skipped: number }> {
  const now = new Date();

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

function getTierCommissionRate(totalReferrals: number): number {
  if (totalReferrals >= 20) return 0.12;
  if (totalReferrals >= 10) return 0.10;
  if (totalReferrals >= 5)  return 0.07;
  return 0.05;
}

async function processReferralCommission(userId: number, earning: number, planName: string): Promise<void> {
  const [user] = await db
    .select({ referredBy: usersTable.referredBy })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user?.referredBy) return;

  const [countRow] = await db
    .select({ total: count(referralsTable.id) })
    .from(referralsTable)
    .where(eq(referralsTable.referrerId, user.referredBy));
  const totalReferrals = countRow?.total ?? 0;

  const commissionRate = getTierCommissionRate(totalReferrals);
  const commission = earning * commissionRate;
  if (commission < 0.0001) return;

  const [referrerWallet] = await db
    .select()
    .from(walletsTable)
    .where(eq(walletsTable.userId, user.referredBy))
    .limit(1);

  if (!referrerWallet) return;

  await db
    .update(walletsTable)
    .set({
      balance: (parseFloat(referrerWallet.balance) + commission).toFixed(8),
      totalEarnings: (parseFloat(referrerWallet.totalEarnings) + commission).toFixed(8),
    })
    .where(eq(walletsTable.userId, user.referredBy));

  await db.insert(transactionsTable).values({
    userId: user.referredBy,
    type: "referral",
    amount: commission.toFixed(8),
    status: "completed",
    txId: generateTxId(),
    note: `Referral commission (${(commissionRate * 100).toFixed(0)}%) from ${planName} earnings`,
  });

  await db
    .update(referralsTable)
    .set({ commissionAmount: commission.toFixed(8), status: "paid" })
    .where(
      and(
        eq(referralsTable.referrerId, user.referredBy),
        eq(referralsTable.referredId, userId)
      )
    );
}
