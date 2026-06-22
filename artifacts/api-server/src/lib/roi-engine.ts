import { eq, and, count, sql, sum, gte } from "drizzle-orm";
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
  referralSalaryTable,
} from "@workspace/db";
import { logger } from "./logger";
import { generateTxId } from "./generate-tx-id";

async function getSetting(key: string, fallback: string): Promise<string> {
  const [s] = await db.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, key)).limit(1);
  return s?.value ?? fallback;
}

// ── Referral Salary ─────────────────────────────────────────────────────────
// Calculates total active investment volume across all users referred by each referrer.

export async function processReferralSalary(): Promise<{ updated: number; paid: number }> {
  const enabled = await getSetting("salary_program_enabled", "true");
  if (enabled !== "true") return { updated: 0, paid: 0 };

  const tier1Volume = parseFloat(await getSetting("salary_tier1_volume", "1500"));
  const tier1Amount = parseFloat(await getSetting("salary_tier1_amount", "100"));
  const tier2Volume = parseFloat(await getSetting("salary_tier2_volume", "3500"));
  const tier2Amount = parseFloat(await getSetting("salary_tier2_amount", "300"));

  // Aggregate active referral investment volume per referrer
  const volumeRows = await db
    .select({
      referrerId: referralsTable.referrerId,
      volume: sum(userInvestmentsTable.amount),
    })
    .from(referralsTable)
    .innerJoin(userInvestmentsTable, and(
      eq(userInvestmentsTable.userId, referralsTable.referredId),
      eq(userInvestmentsTable.status, "active"),
    ))
    .groupBy(referralsTable.referrerId);

  const now = new Date();
  let updated = 0;
  let paid = 0;

  for (const row of volumeRows) {
    const volume = parseFloat(row.volume ?? "0");
    let tier: number | null = null;
    let salary = 0;

    if (volume >= tier2Volume) { tier = 2; salary = tier2Amount; }
    else if (volume >= tier1Volume) { tier = 1; salary = tier1Amount; }

    // Upsert salary record
    const existing = await db
      .select()
      .from(referralSalaryTable)
      .where(eq(referralSalaryTable.userId, row.referrerId))
      .limit(1);

    if (existing.length === 0) {
      const nextPayment = tier ? new Date(now.getTime() + 30 * 86_400_000) : null;
      await db.insert(referralSalaryTable).values({
        userId: row.referrerId,
        currentVolume: volume.toFixed(8),
        currentTier: tier,
        monthlySalary: salary.toFixed(8),
        nextPaymentDate: nextPayment,
        isActive: tier !== null,
        lastCalculatedAt: now,
      });
    } else {
      const record = existing[0];
      const wasActive = record.isActive && record.currentTier !== null;
      const isNowActive = tier !== null;
      const nextPayment = isNowActive && !wasActive
        ? new Date(now.getTime() + 30 * 86_400_000)
        : record.nextPaymentDate;

      await db.update(referralSalaryTable)
        .set({
          currentVolume: volume.toFixed(8),
          currentTier: tier,
          monthlySalary: salary.toFixed(8),
          isActive: isNowActive,
          nextPaymentDate: nextPayment,
          lastCalculatedAt: now,
        })
        .where(eq(referralSalaryTable.userId, row.referrerId));
    }
    updated++;
  }

  // Deactivate users whose referral volume dropped to 0 (not in volumeRows)
  await db.update(referralSalaryTable)
    .set({ currentTier: null, monthlySalary: "0", isActive: false, currentVolume: "0", lastCalculatedAt: now })
    .where(eq(referralSalaryTable.isActive, true));

  // Process due salary payouts
  const dueSalaries = await db
    .select()
    .from(referralSalaryTable)
    .where(eq(referralSalaryTable.isActive, true));

  for (const record of dueSalaries) {
    if (!record.nextPaymentDate || record.nextPaymentDate > now) continue;
    const salaryAmount = parseFloat(record.monthlySalary);
    if (salaryAmount <= 0) continue;

    await db.transaction(async (tx) => {
      await tx.update(walletsTable)
        .set({ balance: sql`CAST(balance AS numeric) + ${salaryAmount}` })
        .where(eq(walletsTable.userId, record.userId));

      await tx.insert(transactionsTable).values({
        userId: record.userId,
        type: "referral",
        amount: salaryAmount.toFixed(8),
        status: "completed",
        txId: generateTxId(),
        note: `Tier ${record.currentTier} referral salary payout`,
      });

      await tx.insert(notificationsTable).values({
        userId: record.userId,
        type: "referral",
        title: "Referral Salary Paid 🎉",
        message: `Your Tier ${record.currentTier} monthly salary of ${salaryAmount.toFixed(2)} USDT has been credited to your wallet.`,
      });

      const nextPayment = new Date(now.getTime() + 30 * 86_400_000);
      await tx.update(referralSalaryTable)
        .set({
          nextPaymentDate: nextPayment,
          totalSalaryPaid: sql`CAST(total_salary_paid AS numeric) + ${salaryAmount}`,
        })
        .where(eq(referralSalaryTable.id, record.id));
    });
    paid++;
  }

  logger.info({ updated, paid }, "Referral salary: cycle complete");
  return { updated, paid };
}

// ── Main ROI Engine ──────────────────────────────────────────────────────────

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

    // Maturity check: use the user's personal endDate, never the plan's closing date.
    // Plan closing only blocks new entries — it must never shorten active investments.
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
          title: "Investment Matured 🎉",
          message: `Your ${plan.name} investment has completed its full cycle. Total earned: ${parseFloat(inv.totalEarned).toFixed(2)} USDT. Visit Portfolio to claim your profits.`,
        });
        matured++;
      }
      continue;
    }

    // ── Auto-compounding profit model ─────────────────────────────────────
    // Principal = original amount + unclaimed profits.
    // This compounds daily while profits remain unclaimed.
    // Claiming resets pendingEarnings to 0, restoring base to original amount.
    // Rate is locked in at investment creation — admin changes never affect active investments.
    const dailyRate = parseFloat(inv.dailyReturnRate);
    const originalAmount = parseFloat(inv.amount);
    const unclaimed = parseFloat(inv.pendingEarnings);
    const effectivePrincipal = originalAmount + unclaimed;
    const earning = effectivePrincipal * dailyRate;

    if (earning <= 0) continue;

    const newPendingEarnings = unclaimed + earning;
    const newTotalEarned = parseFloat(inv.totalEarned) + earning;

    // Always accumulate in pendingEarnings — the compounding happens via effectivePrincipal above.
    // Claiming transfers pendingEarnings to wallet and resets to 0 (base reverts to originalAmount).
    await db
      .update(userInvestmentsTable)
      .set({
        pendingEarnings: newPendingEarnings.toFixed(8),
        totalEarned: newTotalEarned.toFixed(8),
        lastEarningAt: now,
        updatedAt: now,
      })
      .where(eq(userInvestmentsTable.id, inv.id));

    await db.insert(notificationsTable).values({
      userId: inv.userId,
      type: "earning",
      title: "Daily Profit Ready! 💰",
      message: `+${earning.toFixed(2)} USDT added to your ${plan.name} plan. Current investment value: ${(effectivePrincipal + earning).toFixed(2)} USDT. Visit Portfolio to claim profits.`,
    });

    await processReferralCommission(inv.userId, earning, plan.name);

    processed++;
  }

  // Run salary check daily alongside ROI
  try { await processReferralSalary(); } catch (e) { logger.warn(e, "Salary process failed"); }

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
