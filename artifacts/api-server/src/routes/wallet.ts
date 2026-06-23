import { Router, type IRouter } from "express";
import { eq, or, ilike, desc, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import speakeasy from "speakeasy";
import {
  db,
  walletsTable,
  transactionsTable,
  usersTable,
  platformSettingsTable,
  depositNetworksTable,
  notificationsTable,
  withdrawalAddressesTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { generateTxId } from "../lib/generate-tx-id";

const router: IRouter = Router();

async function getSetting(key: string, fallback: string): Promise<string> {
  const [s] = await db.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, key)).limit(1);
  return s?.value ?? fallback;
}

router.get("/wallet", requireAuth, async (req, res): Promise<void> => {
  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, req.session.userId!)).limit(1);

  if (!wallet) {
    res.status(404).json({ error: "Wallet not found" });
    return;
  }

  const networks = await db.select().from(depositNetworksTable).where(eq(depositNetworksTable.isActive, true)).orderBy(depositNetworksTable.id);

  res.json({
    balance: parseFloat(wallet.balance),
    totalDeposited: parseFloat(wallet.totalDeposited),
    totalWithdrawn: parseFloat(wallet.totalWithdrawn),
    totalEarnings: parseFloat(wallet.totalEarnings),
    addresses: networks.map((n) => ({
      network: n.network,
      label: n.label,
      address: n.walletAddress,
      minDeposit: parseFloat(n.minDeposit),
      networkFee: parseFloat(n.networkFee),
      confirmationTime: n.confirmationTime,
    })),
  });
});

router.get("/wallet/transactions", requireAuth, async (req, res): Promise<void> => {
  const { type, limit = "40", offset = "0" } = req.query as Record<string, string>;
  const conditions: any[] = [eq(transactionsTable.userId, req.session.userId!)];
  if (type) conditions.push(eq(transactionsTable.type, type));

  const items = await db
    .select()
    .from(transactionsTable)
    .where(conditions.length === 1 ? conditions[0] : and(...conditions))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(Math.min(parseInt(limit, 10) || 40, 100))
    .offset(parseInt(offset, 10) || 0);

  res.json({
    items: items.map((tx) => {
      let metadata: any = null;
      try { if (tx.metadata) metadata = JSON.parse(tx.metadata as string); } catch {}
      return {
        id: tx.id, type: tx.type, amount: parseFloat(tx.amount),
        fee: parseFloat((tx.fee as string) ?? "0"), status: tx.status,
        network: tx.network, address: tx.address, txHash: tx.txHash,
        txId: tx.txId, note: tx.note, metadata, createdAt: tx.createdAt,
      };
    }),
  });
});

router.get("/wallet/transactions/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (!id || isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [tx] = await db
    .select()
    .from(transactionsTable)
    .where(and(eq(transactionsTable.id, id), eq(transactionsTable.userId, req.session.userId!)))
    .limit(1);

  if (!tx) { res.status(404).json({ error: "Transaction not found" }); return; }

  let metadata: any = null;
  try { if (tx.metadata) metadata = JSON.parse(tx.metadata as string); } catch {}

  res.json({
    id: tx.id, type: tx.type, amount: parseFloat(tx.amount),
    fee: parseFloat((tx.fee as string) ?? "0"), status: tx.status,
    network: tx.network, address: tx.address, txHash: tx.txHash,
    txId: tx.txId, note: tx.note, metadata, createdAt: tx.createdAt, updatedAt: tx.updatedAt,
  });
});

router.post("/wallet/deposit", requireAuth, async (req, res): Promise<void> => {
  const { amount, network, txHash, proofImageUrl } = req.body;

  if (!amount || !network || amount <= 0) {
    res.status(400).json({ error: "Invalid input", message: "Amount and network are required" });
    return;
  }

  const [networkRecord] = await db.select().from(depositNetworksTable).where(eq(depositNetworksTable.network, network)).limit(1);
  const networkMinDeposit = networkRecord ? parseFloat(networkRecord.minDeposit) : 10;
  const globalMinDeposit = parseFloat(await getSetting("min_deposit", "10"));
  const minDeposit = Math.max(networkMinDeposit, globalMinDeposit);

  if (amount < minDeposit) {
    res.status(400).json({ error: "Below minimum", message: `Minimum deposit is ${minDeposit} USDT` });
    return;
  }

  const metadata = proofImageUrl ? JSON.stringify({ proofImageUrl }) : null;

  const [tx] = await db.insert(transactionsTable).values({
    userId: req.session.userId!,
    type: "deposit",
    amount: amount.toString(),
    status: "pending",
    network,
    txHash: txHash || null,
    txId: generateTxId(),
    note: `Deposit via ${network}`,
    metadata,
  } as any).returning();


  await db.insert(notificationsTable).values({
    userId: req.session.userId!,
    type: "transaction",
    title: "Deposit Submitted",
    message: `Your deposit of ${amount} USDT via ${network} has been submitted and is pending review.`,
  });

  res.status(201).json({
    id: tx.id,
    type: tx.type,
    amount: parseFloat(tx.amount),
    status: tx.status,
    network: tx.network,
    txHash: tx.txHash,
    txId: tx.txId,
    createdAt: tx.createdAt,
  });
});

router.post("/wallet/withdraw", requireAuth, async (req, res): Promise<void> => {
  const { amount, network, address, withdrawalPassword, twoFaCode } = req.body;

  if (!amount || !network || !address || amount <= 0) {
    res.status(400).json({ error: "Invalid input", message: "Amount, network, and address are required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!)).limit(1);
  if (user?.withdrawalLocked) {
    res.status(403).json({ error: "Withdrawals locked", message: "Withdrawals are currently locked on your account. Please contact support." });
    return;
  }

  const savedAddresses = await db
    .select()
    .from(withdrawalAddressesTable)
    .where(eq(withdrawalAddressesTable.userId, req.session.userId!));

  const missing: string[] = [];
  if (!user.withdrawalPasswordHash) missing.push("Withdrawal Password");
  if (savedAddresses.length === 0) missing.push("Withdrawal Address");

  if (missing.length > 0) {
    res.status(403).json({
      error: "Security setup required",
      message: `Complete security setup before withdrawing: ${missing.join(", ")}`,
      requiresSecuritySetup: true,
      missing,
    });
    return;
  }

  const twoFaMode = await getSetting("withdrawal_2fa_mode", "optional");

  if (!withdrawalPassword) {
    res.status(400).json({ error: "Password required", message: "Withdrawal password is required" });
    return;
  }
  const passwordValid = await bcrypt.compare(withdrawalPassword, user.withdrawalPasswordHash!);
  if (!passwordValid) {
    res.status(400).json({ error: "Wrong password", message: "Withdrawal password is incorrect" });
    return;
  }

  if (twoFaMode === "always" && user.twoFaEnabled) {
    if (!twoFaCode) {
      res.status(400).json({ error: "2FA required", message: "Authenticator code is required for this withdrawal" });
      return;
    }
    const codeValid = speakeasy.totp.verify({
      secret: user.twoFaSecret!,
      encoding: "base32",
      token: String(twoFaCode),
      window: 1,
    });
    if (!codeValid) {
      res.status(400).json({ error: "Invalid 2FA code", message: "Authenticator code is incorrect or expired" });
      return;
    }
  } else if (twoFaMode !== "disabled" && user.twoFaEnabled && twoFaCode) {
    const codeValid = speakeasy.totp.verify({
      secret: user.twoFaSecret!,
      encoding: "base32",
      token: String(twoFaCode),
      window: 1,
    });
    if (!codeValid) {
      res.status(400).json({ error: "Invalid 2FA code", message: "Authenticator code is incorrect or expired" });
      return;
    }
  }

  const kycRequired = await getSetting("kyc_required_for_withdrawal", "false");
  if (kycRequired === "true" && user?.kycStatus !== "approved") {
    res.status(403).json({ error: "KYC required", message: "You must complete KYC verification before making a withdrawal." });
    return;
  }

  const minWithdrawal = parseFloat(await getSetting("min_withdrawal", "10"));
  if (amount < minWithdrawal) {
    res.status(400).json({ error: "Below minimum", message: `Minimum withdrawal is ${minWithdrawal} USDT` });
    return;
  }

  const feePercent = parseFloat(await getSetting("withdrawal_fee_percent", "1.5")) / 100;
  const fee = amount * feePercent;
  const netAmount = amount - fee;

  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, req.session.userId!)).limit(1);

  if (!wallet || parseFloat(wallet.balance) < amount) {
    res.status(400).json({ error: "Insufficient balance", message: `Insufficient balance. You need ${amount} USDT (including ${fee.toFixed(2)} fee).` });
    return;
  }

  await db.update(walletsTable).set({ balance: (parseFloat(wallet.balance) - amount).toFixed(8) }).where(eq(walletsTable.userId, req.session.userId!));

  const [tx] = await db.insert(transactionsTable).values({
    userId: req.session.userId!,
    type: "withdrawal",
    amount: netAmount.toFixed(8),
    fee: fee.toFixed(8),
    status: "pending",
    network,
    address,
    txId: generateTxId(),
    note: `Withdrawal via ${network} (fee: ${fee.toFixed(2)} USDT)`,
  }).returning();


  await db.insert(notificationsTable).values({
    userId: req.session.userId!,
    type: "transaction",
    title: "Withdrawal Submitted",
    message: `Your withdrawal of ${netAmount.toFixed(2)} USDT via ${network} has been submitted and is pending review.`,
  });

  res.status(201).json({
    id: tx.id,
    type: tx.type,
    amount: parseFloat(tx.amount),
    fee,
    status: tx.status,
    network: tx.network,
    address: tx.address,
    txId: tx.txId,
    createdAt: tx.createdAt,
  });
});

router.get("/wallet/resolve-user", requireAuth, async (req, res): Promise<void> => {
  const { query } = req.query as { query?: string };

  if (!query) {
    res.status(400).json({ error: "Missing query" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(
      or(
        ilike(usersTable.username, query),
        ilike(usersTable.displayId, query),
        eq(usersTable.displayId, query)
      )
    )
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User not found", message: "No user found with that username or ID" });
    return;
  }

  if (user.id === req.session.userId) {
    res.status(400).json({ error: "Cannot transfer to self", message: "You cannot transfer to yourself" });
    return;
  }

  res.json({
    id: user.id,
    displayId: user.displayId,
    username: user.username,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
  });
});

router.post("/wallet/transfer", requireAuth, async (req, res): Promise<void> => {
  const { recipientQuery, amount, note, withdrawalPassword, twoFaCode } = req.body;

  if (!recipientQuery || !amount || amount <= 0) {
    res.status(400).json({ error: "Invalid input", message: "Recipient and amount are required" });
    return;
  }

  const [senderUser] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!)).limit(1);
  if (senderUser?.transferLocked) {
    res.status(403).json({ error: "Transfers locked", message: "Transfers are currently locked on your account." });
    return;
  }

  if (senderUser.withdrawalPasswordHash) {
    if (!withdrawalPassword) {
      res.status(400).json({ error: "Password required", message: "Withdrawal password is required for transfers" });
      return;
    }
    const pwValid = await bcrypt.compare(withdrawalPassword, senderUser.withdrawalPasswordHash);
    if (!pwValid) {
      res.status(400).json({ error: "Wrong password", message: "Withdrawal password is incorrect" });
      return;
    }
  }

  if (senderUser.twoFaEnabled && senderUser.twoFaSecret) {
    if (!twoFaCode) {
      res.status(400).json({ error: "2FA required", message: "Authenticator code is required for transfers" });
      return;
    }
    const codeValid = speakeasy.totp.verify({
      secret: senderUser.twoFaSecret,
      encoding: "base32",
      token: String(twoFaCode),
      window: 1,
    });
    if (!codeValid) {
      res.status(400).json({ error: "Invalid 2FA code", message: "Authenticator code is incorrect or expired" });
      return;
    }
  }

  const [recipient] = await db
    .select()
    .from(usersTable)
    .where(
      or(
        ilike(usersTable.username, recipientQuery),
        ilike(usersTable.displayId, recipientQuery),
        eq(usersTable.displayId, recipientQuery)
      )
    )
    .limit(1);

  if (!recipient) {
    res.status(404).json({ error: "Recipient not found", message: "No user found with that username or ID" });
    return;
  }

  if (recipient.id === req.session.userId) {
    res.status(400).json({ error: "Cannot transfer to self", message: "You cannot transfer to yourself" });
    return;
  }

  const [senderWallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, req.session.userId!)).limit(1);

  if (!senderWallet || parseFloat(senderWallet.balance) < amount) {
    res.status(400).json({ error: "Insufficient balance", message: "Insufficient wallet balance" });
    return;
  }

  await db.update(walletsTable).set({ balance: (parseFloat(senderWallet.balance) - amount).toFixed(8) }).where(eq(walletsTable.userId, req.session.userId!));

  const [recipientWallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, recipient.id)).limit(1);
  if (recipientWallet) {
    await db.update(walletsTable).set({ balance: (parseFloat(recipientWallet.balance) + amount).toFixed(8) }).where(eq(walletsTable.userId, recipient.id));
  }

  const senderTxId = generateTxId();

  const [tx] = await db.insert(transactionsTable).values({
    userId: req.session.userId!,
    type: "transfer",
    amount: amount.toString(),
    status: "completed",
    txId: senderTxId,
    note: note || `Transfer to @${recipient.username}`,
  }).returning();

  await db.insert(transactionsTable).values({
    userId: recipient.id,
    type: "transfer",
    amount: amount.toString(),
    status: "completed",
    txId: generateTxId(),
    note: `Received from @${senderUser?.username ?? "user"}`,
  });

  await db.insert(notificationsTable).values({
    userId: recipient.id,
    type: "transaction",
    title: "Transfer Received",
    message: `You received ${amount} USDT from @${senderUser?.username ?? "user"}.`,
  });

  res.status(201).json({
    id: tx.id,
    type: tx.type,
    amount: parseFloat(tx.amount),
    status: tx.status,
    txId: tx.txId,
    note: tx.note,
    recipient: { username: recipient.username, displayId: recipient.displayId, fullName: recipient.fullName },
    createdAt: tx.createdAt,
  });
});

export default router;
