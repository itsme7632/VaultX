import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq, ilike, desc, count, sum, or, and, gte, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  walletsTable,
  kycSubmissionsTable,
  transactionsTable,
  notificationsTable,
  userInvestmentsTable,
  investmentPlansTable,
  referralsTable,
  platformSettingsTable,
  adminActionLogsTable,
} from "@workspace/db";
import { requireAdmin } from "../middlewares/auth";
import { generateTxId } from "../lib/generate-tx-id";
import { processAllInvestments } from "../lib/roi-engine";

const router: IRouter = Router();

function serializeUser(user: typeof usersTable.$inferSelect, wallet?: typeof walletsTable.$inferSelect | null) {
  return {
    id: user.id,
    displayId: user.displayId,
    fullName: user.fullName,
    username: user.username,
    email: user.email,
    whatsapp: user.whatsapp,
    country: user.country,
    balance: parseFloat(wallet?.balance ?? "0"),
    totalDeposited: parseFloat(wallet?.totalDeposited ?? "0"),
    totalWithdrawn: parseFloat(wallet?.totalWithdrawn ?? "0"),
    totalEarnings: parseFloat(wallet?.totalEarnings ?? "0"),
    kycStatus: user.kycStatus,
    isAdmin: user.isAdmin,
    isActive: user.isActive,
    twoFaEnabled: user.twoFaEnabled,
    withdrawalLocked: user.withdrawalLocked,
    transferLocked: user.transferLocked,
    whatsappLocked: user.whatsappLocked,
    ipAddress: user.ipAddress,
    lastLoginIp: user.lastLoginIp,
    referralCode: user.referralCode,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

router.get("/admin/users", requireAdmin, async (req, res): Promise<void> => {
  const { search, limit = "20", offset = "0" } = req.query as Record<string, string>;

  const whereClause = search
    ? or(
        ilike(usersTable.email, `%${search}%`),
        ilike(usersTable.username, `%${search}%`),
        ilike(usersTable.fullName, `%${search}%`),
        ilike(usersTable.displayId, `%${search}%`)
      )
    : undefined;

  const results = await db
    .select({ user: usersTable, wallet: walletsTable })
    .from(usersTable)
    .leftJoin(walletsTable, eq(walletsTable.userId, usersTable.id))
    .where(whereClause)
    .orderBy(desc(usersTable.createdAt))
    .limit(parseInt(limit, 10))
    .offset(parseInt(offset, 10));

  const total = search
    ? results.length
    : (await db.select({ c: count() }).from(usersTable))[0]?.c ?? 0;

  res.json({
    items: results.map((r) => serializeUser(r.user, r.wallet)),
    total,
  });
});

router.get("/admin/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [result] = await db
    .select({ user: usersTable, wallet: walletsTable })
    .from(usersTable)
    .leftJoin(walletsTable, eq(walletsTable.userId, usersTable.id))
    .where(eq(usersTable.id, id))
    .limit(1);

  if (!result) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const investments = await db
    .select({ inv: userInvestmentsTable, planName: investmentPlansTable.name })
    .from(userInvestmentsTable)
    .leftJoin(investmentPlansTable, eq(userInvestmentsTable.planId, investmentPlansTable.id))
    .where(eq(userInvestmentsTable.userId, id))
    .orderBy(desc(userInvestmentsTable.createdAt))
    .limit(10);

  const referralCount = await db
    .select({ c: count() })
    .from(referralsTable)
    .where(eq(referralsTable.referrerId, id));

  res.json({
    ...serializeUser(result.user, result.wallet),
    referralCount: referralCount[0]?.c ?? 0,
    investments: investments.map((r) => ({
      id: r.inv.id,
      planName: r.planName,
      amount: parseFloat(r.inv.amount),
      totalEarned: parseFloat(r.inv.totalEarned),
      pendingEarnings: parseFloat(r.inv.pendingEarnings),
      status: r.inv.status,
      startDate: r.inv.startDate,
      endDate: r.inv.endDate,
    })),
  });
});

router.put("/admin/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { fullName, email, whatsapp, country, isAdmin, isActive, withdrawalLocked, transferLocked, whatsappLocked } = req.body;

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  await db.update(usersTable).set({
    fullName: fullName ?? existing.fullName,
    email: email ?? existing.email,
    whatsapp: whatsapp !== undefined ? whatsapp : existing.whatsapp,
    country: country !== undefined ? country : existing.country,
    isAdmin: isAdmin !== undefined ? isAdmin : existing.isAdmin,
    isActive: isActive !== undefined ? isActive : existing.isActive,
    withdrawalLocked: withdrawalLocked !== undefined ? withdrawalLocked : existing.withdrawalLocked,
    transferLocked: transferLocked !== undefined ? transferLocked : existing.transferLocked,
    whatsappLocked: whatsappLocked !== undefined ? whatsappLocked : existing.whatsappLocked,
  }).where(eq(usersTable.id, id));

  const [updated] = await db
    .select({ user: usersTable, wallet: walletsTable })
    .from(usersTable)
    .leftJoin(walletsTable, eq(walletsTable.userId, usersTable.id))
    .where(eq(usersTable.id, id))
    .limit(1);

  res.json(serializeUser(updated.user, updated.wallet));
});

router.post("/admin/users/:id/adjust-balance", requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { amount, reason } = req.body;

  if (amount === undefined || !reason) {
    res.status(400).json({ error: "Amount and reason required" });
    return;
  }

  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, id)).limit(1);
  if (!wallet) {
    res.status(404).json({ error: "Wallet not found" });
    return;
  }

  const adj = parseFloat(amount);
  const newBalance = Math.max(0, parseFloat(wallet.balance) + adj);
  await db.update(walletsTable).set({ balance: newBalance.toFixed(8) }).where(eq(walletsTable.userId, id));

  await db.insert(transactionsTable).values({
    userId: id,
    type: "admin_adjustment",
    amount: Math.abs(adj).toFixed(8),
    status: "completed",
    txId: generateTxId(),
    note: `Admin adjustment: ${reason}`,
  });

  await db.insert(notificationsTable).values({
    userId: id,
    type: "transaction",
    title: adj > 0 ? "Balance Credited" : "Balance Adjusted",
    message: `Your balance has been ${adj > 0 ? "credited" : "adjusted"} by ${Math.abs(adj).toFixed(2)} USDT. Reason: ${reason}`,
  });

  res.json({ success: true, newBalance, message: "Balance adjusted" });
});

router.post("/admin/users/:id/reset-2fa", requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  await db.update(usersTable).set({ twoFaEnabled: false, twoFaSecret: null }).where(eq(usersTable.id, id));
  await db.insert(notificationsTable).values({
    userId: id,
    type: "security",
    title: "2FA Reset",
    message: "Your two-factor authentication has been reset by an administrator.",
  });

  res.json({ success: true });
});

router.post("/admin/users/:id/reset-password", requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { password } = req.body ?? {};

  if (!password || password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, id));

  await db.insert(adminActionLogsTable).values({
    adminId: req.session.userId!,
    targetUserId: id,
    action: "password_reset",
    details: `Password reset for @${user.username} (${user.email})`,
  });

  await db.insert(notificationsTable).values({
    userId: id,
    type: "security",
    title: "Password Reset",
    message: "Your password has been reset by an administrator. If you did not request this, please contact support immediately.",
  });

  res.json({ success: true });
});

router.get("/admin/password-reset-logs", requireAdmin, async (req, res): Promise<void> => {
  const logs = await db
    .select()
    .from(adminActionLogsTable)
    .where(eq(adminActionLogsTable.action, "password_reset"))
    .orderBy(desc(adminActionLogsTable.createdAt))
    .limit(200);

  if (logs.length === 0) {
    res.json([]);
    return;
  }

  const userIds = [...new Set([...logs.map((l) => l.adminId), ...logs.map((l) => l.targetUserId)])];
  const users = await db
    .select({ id: usersTable.id, username: usersTable.username })
    .from(usersTable)
    .where(or(...userIds.map((uid) => eq(usersTable.id, uid))));

  const userMap = Object.fromEntries(users.map((u) => [u.id, u.username]));

  res.json(
    logs.map((l) => ({
      id: l.id,
      adminUsername: userMap[l.adminId] ?? `#${l.adminId}`,
      targetUsername: userMap[l.targetUserId] ?? `#${l.targetUserId}`,
      details: l.details,
      createdAt: l.createdAt,
    }))
  );
});

router.post("/admin/users/:id/notify", requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { title, message, type = "announcement" } = req.body;

  if (!title || !message) {
    res.status(400).json({ error: "Title and message required" });
    return;
  }

  await db.insert(notificationsTable).values({ userId: id, type, title, message });
  res.json({ success: true });
});

router.get("/admin/kyc", requireAdmin, async (req, res): Promise<void> => {
  const { status } = req.query as { status?: string };

  const submissions = await db
    .select({ sub: kycSubmissionsTable, username: usersTable.username, fullName: usersTable.fullName })
    .from(kycSubmissionsTable)
    .leftJoin(usersTable, eq(kycSubmissionsTable.userId, usersTable.id))
    .where(status ? eq(kycSubmissionsTable.status, status) : undefined)
    .orderBy(desc(kycSubmissionsTable.submittedAt));

  res.json(submissions.map((s) => ({
    id: s.sub.id,
    userId: s.sub.userId,
    username: s.username ?? "Unknown",
    fullName: s.sub.fullLegalName || s.fullName || "Unknown",
    documentType: s.sub.documentType,
    documentNumber: s.sub.documentNumber,
    country: s.sub.country,
    frontImageUrl: s.sub.frontImageUrl,
    backImageUrl: s.sub.backImageUrl,
    selfieUrl: s.sub.selfieUrl,
    status: s.sub.status,
    rejectionReason: s.sub.rejectionReason,
    submittedAt: s.sub.submittedAt,
    reviewedAt: s.sub.reviewedAt,
  })));
});

router.post("/admin/kyc/:id/approve", requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [sub] = await db.select().from(kycSubmissionsTable).where(eq(kycSubmissionsTable.id, id)).limit(1);
  if (!sub) {
    res.status(404).json({ error: "Submission not found" });
    return;
  }

  await db.update(kycSubmissionsTable).set({ status: "approved", reviewedAt: new Date() }).where(eq(kycSubmissionsTable.id, id));
  await db.update(usersTable).set({ kycStatus: "approved", isVerified: true }).where(eq(usersTable.id, sub.userId));
  await db.insert(notificationsTable).values({
    userId: sub.userId,
    type: "security",
    title: "KYC Approved",
    message: "Your identity verification has been approved. Your account is now fully verified.",
  });

  res.json({ success: true });
});

router.post("/admin/kyc/:id/reject", requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { reason } = req.body;

  const [sub] = await db.select().from(kycSubmissionsTable).where(eq(kycSubmissionsTable.id, id)).limit(1);
  if (!sub) {
    res.status(404).json({ error: "Submission not found" });
    return;
  }

  await db.update(kycSubmissionsTable).set({ status: "rejected", reviewedAt: new Date(), rejectionReason: reason }).where(eq(kycSubmissionsTable.id, id));
  await db.update(usersTable).set({ kycStatus: "rejected" }).where(eq(usersTable.id, sub.userId));
  await db.insert(notificationsTable).values({
    userId: sub.userId,
    type: "security",
    title: "KYC Rejected",
    message: `Your identity verification was rejected. Reason: ${reason || "Please resubmit with clearer images."}`,
  });

  res.json({ success: true });
});

router.get("/admin/withdrawals", requireAdmin, async (req, res): Promise<void> => {
  const { status, txId: txIdSearch } = req.query as { status?: string; txId?: string };
  const where = and(
    eq(transactionsTable.type, "withdrawal"),
    status ? eq(transactionsTable.status, status) : undefined,
    txIdSearch ? ilike(transactionsTable.txId, `%${txIdSearch}%`) : undefined
  );

  const withdrawals = await db
    .select({ tx: transactionsTable, username: usersTable.username, displayId: usersTable.displayId })
    .from(transactionsTable)
    .leftJoin(usersTable, eq(transactionsTable.userId, usersTable.id))
    .where(where)
    .orderBy(desc(transactionsTable.createdAt))
    .limit(100);

  res.json(withdrawals.map((w) => ({
    id: w.tx.id,
    userId: w.tx.userId,
    username: w.username,
    displayId: w.displayId,
    amount: parseFloat(w.tx.amount),
    fee: parseFloat(w.tx.fee ?? "0"),
    network: w.tx.network,
    address: w.tx.address,
    txHash: w.tx.txHash,
    txId: w.tx.txId,
    status: w.tx.status,
    note: w.tx.note,
    createdAt: w.tx.createdAt,
  })));
});

router.post("/admin/withdrawals/:id/approve", requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { txHash } = req.body ?? {};

  const [tx] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id)).limit(1);
  if (!tx) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }

  await db.update(transactionsTable).set({ status: "completed", txHash: txHash || null, updatedAt: new Date() }).where(eq(transactionsTable.id, id));

  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, tx.userId)).limit(1);
  if (wallet) {
    const newWithdrawn = parseFloat(wallet.totalWithdrawn) + parseFloat(tx.amount);
    await db.update(walletsTable).set({ totalWithdrawn: newWithdrawn.toFixed(8) }).where(eq(walletsTable.userId, tx.userId));
  }

  await db.insert(notificationsTable).values({
    userId: tx.userId,
    type: "transaction",
    title: "Withdrawal Approved",
    message: `Your withdrawal of ${parseFloat(tx.amount).toFixed(2)} USDT has been processed.${txHash ? ` TX: ${txHash}` : ""}`,
  });

  res.json({ success: true });
});

router.post("/admin/withdrawals/:id/reject", requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { reason } = req.body;

  const [tx] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id)).limit(1);
  if (!tx) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }

  await db.update(transactionsTable).set({ status: "failed", updatedAt: new Date() }).where(eq(transactionsTable.id, id));

  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, tx.userId)).limit(1);
  if (wallet) {
    const refundBalance = parseFloat(wallet.balance) + parseFloat(tx.amount);
    await db.update(walletsTable).set({ balance: refundBalance.toFixed(8) }).where(eq(walletsTable.userId, tx.userId));
  }

  await db.insert(notificationsTable).values({
    userId: tx.userId,
    type: "transaction",
    title: "Withdrawal Rejected",
    message: `Your withdrawal of ${parseFloat(tx.amount).toFixed(2)} USDT was rejected. ${reason ? `Reason: ${reason}` : "Please contact support."} The amount has been refunded.`,
  });

  res.json({ success: true });
});

// ─── DEPOSITS ─────────────────────────────────────────────────────────────
router.get("/admin/deposits", requireAdmin, async (req, res): Promise<void> => {
  const { status = "pending", txId: txIdSearch } = req.query as { status?: string; txId?: string };

  const deposits = await db
    .select({ tx: transactionsTable, username: usersTable.username, displayId: usersTable.displayId, fullName: usersTable.fullName })
    .from(transactionsTable)
    .leftJoin(usersTable, eq(transactionsTable.userId, usersTable.id))
    .where(and(
      eq(transactionsTable.type, "deposit"),
      status !== "all" ? eq(transactionsTable.status, status) : undefined,
      txIdSearch ? ilike(transactionsTable.txId, `%${txIdSearch}%`) : undefined
    ))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(100);

  res.json(deposits.map((d) => {
    let metadata: Record<string, string> | null = null;
    try { if (d.tx.metadata) metadata = JSON.parse(d.tx.metadata); } catch {}
    return {
      id: d.tx.id,
      userId: d.tx.userId,
      username: d.username,
      displayId: d.displayId,
      fullName: d.fullName,
      amount: parseFloat(d.tx.amount),
      network: d.tx.network,
      address: d.tx.address,
      txHash: d.tx.txHash,
      txId: d.tx.txId,
      proofImageUrl: metadata?.proofImageUrl ?? null,
      status: d.tx.status,
      note: d.tx.note,
      createdAt: d.tx.createdAt,
    };
  }));
});

router.post("/admin/deposits/:id/approve", requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [tx] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id)).limit(1);
  if (!tx) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }
  if (tx.status !== "pending") {
    res.status(400).json({ error: "Already processed", message: "This deposit has already been processed" });
    return;
  }

  await db.update(transactionsTable).set({ status: "completed", updatedAt: new Date() }).where(eq(transactionsTable.id, id));

  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, tx.userId)).limit(1);
  if (wallet) {
    const newBalance = parseFloat(wallet.balance) + parseFloat(tx.amount);
    const newDeposited = parseFloat(wallet.totalDeposited) + parseFloat(tx.amount);
    await db.update(walletsTable).set({
      balance: newBalance.toFixed(8),
      totalDeposited: newDeposited.toFixed(8),
    }).where(eq(walletsTable.userId, tx.userId));
  }

  await db.insert(notificationsTable).values({
    userId: tx.userId,
    type: "transaction",
    title: "Deposit Confirmed",
    message: `Your deposit of ${parseFloat(tx.amount).toFixed(2)} USDT has been confirmed and credited to your wallet.`,
  });

  const [depositor] = await db.select().from(usersTable).where(eq(usersTable.id, tx.userId)).limit(1);
  if (depositor?.referredBy) {
    const [commSetting] = await db.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, "referral_commission_rate")).limit(1);
    const commRate = parseFloat(commSetting?.value ?? "5") / 100;
    const commAmount = parseFloat(tx.amount) * commRate;

    if (commAmount > 0) {
      const [referrerWallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, depositor.referredBy)).limit(1);
      if (referrerWallet) {
        await db.update(walletsTable).set({
          balance: (parseFloat(referrerWallet.balance) + commAmount).toFixed(8),
        }).where(eq(walletsTable.userId, depositor.referredBy));
      }

      await db.update(referralsTable).set({
        commissionAmount: commAmount.toFixed(8),
        status: "active",
      }).where(and(eq(referralsTable.referrerId, depositor.referredBy), eq(referralsTable.referredId, tx.userId)));

      await db.insert(transactionsTable).values({
        userId: depositor.referredBy,
        type: "referral",
        amount: commAmount.toFixed(8),
        status: "completed",
        txId: `REF-${tx.id}`,
        note: `Referral commission (${(commRate * 100).toFixed(1)}%) from @${depositor.username ?? "user"} deposit`,
      });

      await db.insert(notificationsTable).values({
        userId: depositor.referredBy,
        type: "transaction",
        title: "Referral Commission Earned",
        message: `You earned ${commAmount.toFixed(2)} USDT referral commission from @${depositor.username ?? "user"}'s deposit.`,
      });
    }
  }

  res.json({ success: true });
});

router.post("/admin/deposits/:id/reject", requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { reason } = req.body;

  const [tx] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id)).limit(1);
  if (!tx) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }

  await db.update(transactionsTable).set({ status: "failed", updatedAt: new Date() }).where(eq(transactionsTable.id, id));

  await db.insert(notificationsTable).values({
    userId: tx.userId,
    type: "transaction",
    title: "Deposit Rejected",
    message: `Your deposit of ${parseFloat(tx.amount).toFixed(2)} USDT was rejected. ${reason ? `Reason: ${reason}` : "Please contact support with your payment proof."}`,
  });

  res.json({ success: true });
});

router.post("/admin/notifications/broadcast", requireAdmin, async (req, res): Promise<void> => {
  const { title, message, type = "announcement" } = req.body;

  if (!title || !message) {
    res.status(400).json({ error: "Title and message required" });
    return;
  }

  const users = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.isActive, true));

  const values = users.map((u) => ({
    userId: u.id,
    type: type as string,
    title,
    message,
    isBroadcast: true,
  }));

  if (values.length > 0) {
    for (let i = 0; i < values.length; i += 100) {
      await db.insert(notificationsTable).values(values.slice(i, i + 100));
    }
  }

  res.json({ success: true, sentTo: users.length });
});

router.get("/admin/analytics", requireAdmin, async (req, res): Promise<void> => {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);

  const [totalUsersRes] = await db.select({ c: count() }).from(usersTable);
  const [activeUsersRes] = await db.select({ c: count() }).from(usersTable).where(eq(usersTable.isActive, true));
  const [activeInvsRes] = await db.select({ c: count() }).from(userInvestmentsTable).where(eq(userInvestmentsTable.status, "active"));
  const [newTodayRes] = await db.select({ c: count() }).from(usersTable).where(gte(usersTable.createdAt, todayStart));
  const [pendingKycRes] = await db.select({ c: count() }).from(kycSubmissionsTable).where(eq(kycSubmissionsTable.status, "pending"));
  const [pendingWdRes] = await db.select({ c: count() }).from(transactionsTable).where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "pending")));
  const [pendingDepRes] = await db.select({ c: count() }).from(transactionsTable).where(and(eq(transactionsTable.type, "deposit"), eq(transactionsTable.status, "pending")));

  const depositsRes = await db.select({ s: sum(transactionsTable.amount) }).from(transactionsTable).where(and(eq(transactionsTable.type, "deposit"), eq(transactionsTable.status, "completed")));
  const withdrawalsRes = await db.select({ s: sum(transactionsTable.amount) }).from(transactionsTable).where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "completed")));
  const earningsRes = await db.select({ s: sum(transactionsTable.amount) }).from(transactionsTable).where(and(or(eq(transactionsTable.type, "earning"), eq(transactionsTable.type, "reinvest")), eq(transactionsTable.status, "completed")));
  const invValueRes = await db.select({ s: sum(userInvestmentsTable.amount) }).from(userInvestmentsTable).where(eq(userInvestmentsTable.status, "active"));

  const depositsTodayRes = await db.select({ s: sum(transactionsTable.amount) }).from(transactionsTable).where(and(eq(transactionsTable.type, "deposit"), eq(transactionsTable.status, "completed"), gte(transactionsTable.createdAt, todayStart)));
  const withdrawalsTodayRes = await db.select({ s: sum(transactionsTable.amount) }).from(transactionsTable).where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "completed"), gte(transactionsTable.createdAt, todayStart)));

  res.json({
    totalUsers: totalUsersRes?.c ?? 0,
    activeUsers: activeUsersRes?.c ?? 0,
    activeInvestments: activeInvsRes?.c ?? 0,
    totalDeposits: parseFloat(depositsRes[0]?.s ?? "0"),
    totalWithdrawals: parseFloat(withdrawalsRes[0]?.s ?? "0"),
    totalEarningsPaid: parseFloat(earningsRes[0]?.s ?? "0"),
    activeInvestmentsValue: parseFloat(invValueRes[0]?.s ?? "0"),
    depositsToday: parseFloat(depositsTodayRes[0]?.s ?? "0"),
    withdrawalsToday: parseFloat(withdrawalsTodayRes[0]?.s ?? "0"),
    pendingWithdrawals: pendingWdRes?.c ?? 0,
    pendingDeposits: pendingDepRes?.c ?? 0,
    pendingKyc: pendingKycRes?.c ?? 0,
    newUsersToday: newTodayRes?.c ?? 0,
    revenueToday: parseFloat(depositsTodayRes[0]?.s ?? "0"),
    totalInvestments: parseFloat(invValueRes[0]?.s ?? "0"),
  });
});

router.get("/admin/plans", requireAdmin, async (req, res): Promise<void> => {
  const plans = await db.select().from(investmentPlansTable).orderBy(investmentPlansTable.id);
  res.json(plans.map((p) => ({
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
    isActive: p.isActive,
    isFeatured: p.isFeatured,
  })));
});

router.post("/admin/plans", requireAdmin, async (req, res): Promise<void> => {
  const { name, description, minAmount, maxAmount, dailyReturnRate, minRoiRate, maxRoiRate, durationDays, riskLevel, features, isActive, isFeatured } = req.body;

  if (!name || !description || !minAmount || !maxAmount || !durationDays) {
    res.status(400).json({ error: "Name, description, amounts, and duration required" });
    return;
  }

  const midRoi = ((parseFloat(minRoiRate ?? "0.025") + parseFloat(maxRoiRate ?? "0.030")) / 2);

  const [plan] = await db.insert(investmentPlansTable).values({
    name,
    description,
    minAmount: minAmount.toString(),
    maxAmount: maxAmount.toString(),
    dailyReturnRate: (dailyReturnRate ?? midRoi).toString(),
    minRoiRate: (minRoiRate ?? 0.025).toString(),
    maxRoiRate: (maxRoiRate ?? 0.030).toString(),
    durationDays: parseInt(durationDays, 10),
    riskLevel: riskLevel ?? "medium",
    features: features ?? [],
    isActive: isActive ?? true,
    isFeatured: isFeatured ?? false,
  }).returning();

  res.status(201).json(plan);
});

router.put("/admin/plans/:id", requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { name, description, minAmount, maxAmount, dailyReturnRate, minRoiRate, maxRoiRate, durationDays, riskLevel, features, isActive, isFeatured } = req.body;

  const [existing] = await db.select().from(investmentPlansTable).where(eq(investmentPlansTable.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Plan not found" });
    return;
  }

  const [updated] = await db.update(investmentPlansTable).set({
    name: name ?? existing.name,
    description: description ?? existing.description,
    minAmount: minAmount !== undefined ? minAmount.toString() : existing.minAmount,
    maxAmount: maxAmount !== undefined ? maxAmount.toString() : existing.maxAmount,
    dailyReturnRate: dailyReturnRate !== undefined ? dailyReturnRate.toString() : existing.dailyReturnRate,
    minRoiRate: minRoiRate !== undefined ? minRoiRate.toString() : existing.minRoiRate,
    maxRoiRate: maxRoiRate !== undefined ? maxRoiRate.toString() : existing.maxRoiRate,
    durationDays: durationDays !== undefined ? parseInt(durationDays, 10) : existing.durationDays,
    riskLevel: riskLevel ?? existing.riskLevel,
    features: features !== undefined ? features : existing.features,
    isActive: isActive !== undefined ? isActive : existing.isActive,
    isFeatured: isFeatured !== undefined ? isFeatured : existing.isFeatured,
  }).where(eq(investmentPlansTable.id, id)).returning();

  res.json(updated);
});

router.delete("/admin/plans/:id", requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  await db.update(investmentPlansTable).set({ isActive: false }).where(eq(investmentPlansTable.id, id));
  res.json({ success: true });
});

router.post("/admin/roi/trigger", requireAdmin, async (req, res): Promise<void> => {
  const { force = true } = req.body as { force?: boolean };
  try {
    const result = await processAllInvestments(force);
    res.json({
      success: true,
      processed: result.processed,
      matured: result.matured,
      skipped: result.skipped,
    });
  } catch (err: any) {
    res.status(500).json({ error: "ROI processing failed", message: err?.message ?? String(err) });
  }
});

router.get("/admin/settings", requireAdmin, async (req, res): Promise<void> => {
  const settings = await db.select().from(platformSettingsTable);
  const obj: Record<string, string> = {};
  for (const s of settings) obj[s.key] = s.value;
  res.json(obj);
});

router.put("/admin/settings", requireAdmin, async (req, res): Promise<void> => {
  const updates = req.body as Record<string, string>;

  for (const [key, value] of Object.entries(updates)) {
    await db.insert(platformSettingsTable).values({ key, value: String(value) })
      .onConflictDoUpdate({ target: platformSettingsTable.key, set: { value: String(value), updatedAt: new Date() } });
  }

  res.json({ success: true });
});

export default router;
