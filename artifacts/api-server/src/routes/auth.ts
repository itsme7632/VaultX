import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq, or, sql } from "drizzle-orm";
import { db, usersTable, passwordResetTokensTable, referralsTable, walletsTable, transactionsTable, notificationsTable, platformSettingsTable } from "@workspace/db";
import { ensureWallet } from "../lib/wallet";
import { generateReferralCode } from "../lib/referral";
import { requireAuth } from "../middlewares/auth";
import { v4 as uuidv4 } from "uuid";

const router: IRouter = Router();

function serializeUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    displayId: user.displayId,
    fullName: user.fullName,
    username: user.username,
    email: user.email,
    whatsapp: user.whatsapp,
    country: user.country,
    avatarUrl: user.avatarUrl,
    referralCode: user.referralCode,
    kycStatus: user.kycStatus,
    twoFaEnabled: user.twoFaEnabled,
    isAdmin: user.isAdmin,
    isVerified: user.isVerified,
    withdrawalLocked: user.withdrawalLocked,
    transferLocked: user.transferLocked,
    whatsappLocked: user.whatsappLocked,
    createdAt: user.createdAt,
  };
}

async function generateDisplayId(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const id = String(Math.floor(100000 + Math.random() * 900000));
    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.displayId, id))
      .limit(1);
    if (!existing.length) return id;
  }
  return String(Date.now()).slice(-6);
}

router.post("/auth/signup", async (req, res): Promise<void> => {
  const { fullName, username, email, whatsapp, country, password, confirmPassword, referralCode, referralSource } = req.body;

  // --- Individual field validation ---
  if (!fullName || !String(fullName).trim()) {
    res.status(400).json({ error: "Full name required", message: "Full name is required" });
    return;
  }

  if (!username || !String(username).trim()) {
    res.status(400).json({ error: "Username required", message: "Username is required" });
    return;
  }

  if (!email || !String(email).trim()) {
    res.status(400).json({ error: "Email required", message: "Email address is required" });
    return;
  }

  const whatsappTrimmed = whatsapp != null ? String(whatsapp).trim() : "";
  if (!whatsappTrimmed) {
    res.status(400).json({ error: "WhatsApp required", message: "WhatsApp number is required for account recovery and notifications" });
    return;
  }

  if (!password) {
    res.status(400).json({ error: "Password required", message: "Password is required" });
    return;
  }

  if (!confirmPassword) {
    res.status(400).json({ error: "Confirm password required", message: "Please confirm your password" });
    return;
  }

  if (password !== confirmPassword) {
    res.status(400).json({ error: "Password mismatch", message: "Passwords do not match" });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: "Weak password", message: "Password must be at least 8 characters" });
    return;
  }

  const existing = await db
    .select()
    .from(usersTable)
    .where(or(eq(usersTable.email, email.toLowerCase()), eq(usersTable.username, username.toLowerCase())))
    .limit(1);

  if (existing.length > 0) {
    const conflict = existing[0].email === email.toLowerCase() ? "email" : "username";
    res.status(400).json({ error: "Conflict", message: `This ${conflict} is already taken` });
    return;
  }

  let referredById: number | undefined;
  if (referralCode) {
    const referrer = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.referralCode, referralCode.toUpperCase()))
      .limit(1);
    if (referrer.length > 0) referredById = referrer[0].id;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const newReferralCode = generateReferralCode();
  const displayId = await generateDisplayId();

  const [user] = await db
    .insert(usersTable)
    .values({
      displayId,
      fullName,
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      whatsapp: whatsappTrimmed,
      country: country || null,
      passwordHash,
      referralCode: newReferralCode,
      referredBy: referredById || null,
      ipAddress: req.ip ?? null,
      whatsappLocked: true,
    })
    .returning();

  await ensureWallet(user.id);

  if (referredById) {
    const validSources = ["whatsapp", "telegram", "direct", "other"];
    const src = typeof referralSource === "string" && validSources.includes(referralSource.toLowerCase())
      ? referralSource.toLowerCase()
      : "direct";
    await db.insert(referralsTable).values({
      referrerId: referredById,
      referredId: user.id,
      commissionAmount: "0",
      status: "pending",
      referralSource: src,
    });
  }

  const [bonusEnabled] = await db.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, "signup_bonus_enabled")).limit(1);
  const [bonusAmount] = await db.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, "signup_bonus_amount")).limit(1);

  if (bonusEnabled?.value === "true") {
    const bonus = parseFloat(bonusAmount?.value ?? "0");
    if (bonus > 0) {
      await db.update(walletsTable).set({
        balance: sql`balance + ${bonus.toFixed(8)}`,
        totalEarnings: sql`total_earnings + ${bonus.toFixed(8)}`,
      }).where(eq(walletsTable.userId, user.id));

      await db.insert(transactionsTable).values({
        userId: user.id,
        type: "earning",
        amount: bonus.toFixed(8),
        status: "completed",
        txId: `SIGNUP-BONUS-${user.id}`,
        note: `Welcome signup bonus`,
      });

      await db.insert(notificationsTable).values({
        userId: user.id,
        type: "announcement",
        title: "🎉 Welcome Bonus Credited!",
        message: `You've received a ${bonus.toFixed(2)} USDT signup bonus. Start investing and grow your portfolio!`,
      });
    }
  }

  req.session.userId = user.id;
  req.session.isAdmin = user.isAdmin;

  res.status(201).json({ user: serializeUser(user) });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Missing fields", message: "Email and password are required" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()))
    .limit(1);

  if (!user) {
    res.status(401).json({ error: "Invalid credentials", message: "No account found with this email" });
    return;
  }

  if (!user.isActive) {
    res.status(401).json({ error: "Account disabled", message: "Your account has been disabled" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials", message: "Incorrect password" });
    return;
  }

  await db
    .update(usersTable)
    .set({ lastLoginAt: new Date(), lastLoginIp: req.ip ?? null })
    .where(eq(usersTable.id, user.id));

  req.session.userId = user.id;
  req.session.isAdmin = user.isAdmin;

  res.json({ user: serializeUser(user) });
});

router.post("/auth/logout", requireAuth, async (req, res): Promise<void> => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ success: false, message: "Failed to logout" });
      return;
    }
    res.clearCookie("connect.sid");
    res.json({ success: true, message: "Logged out" });
  });
});

router.post("/auth/refresh-session", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId!))
    .limit(1);

  if (!user) {
    res.status(401).json({ error: "Not found" });
    return;
  }

  req.session.isAdmin = user.isAdmin;
  res.json({ isAdmin: user.isAdmin });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId!))
    .limit(1);

  if (!user) {
    res.status(401).json({ error: "Not found", message: "User not found" });
    return;
  }

  res.json(serializeUser(user));
});

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const { email } = req.body;
  if (!email) {
    res.status(400).json({ error: "Missing email", message: "Email is required" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()))
    .limit(1);

  if (user) {
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await db.insert(passwordResetTokensTable).values({
      userId: user.id,
      token,
      expiresAt,
    });
    req.log.info({ token }, "Password reset token generated");
  }

  res.json({ success: true, message: "If that email exists, a reset link has been sent" });
});

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const { token, password, confirmPassword } = req.body;

  if (!token || !password || !confirmPassword) {
    res.status(400).json({ error: "Missing fields", message: "All fields are required" });
    return;
  }

  if (password !== confirmPassword) {
    res.status(400).json({ error: "Password mismatch", message: "Passwords do not match" });
    return;
  }

  const [resetToken] = await db
    .select()
    .from(passwordResetTokensTable)
    .where(eq(passwordResetTokensTable.token, token))
    .limit(1);

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    res.status(400).json({ error: "Invalid token", message: "Reset link is invalid or expired" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await db
    .update(usersTable)
    .set({ passwordHash })
    .where(eq(usersTable.id, resetToken.userId));

  await db
    .update(passwordResetTokensTable)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokensTable.id, resetToken.id));

  res.json({ success: true, message: "Password reset successfully" });
});

// ── Username availability check ────────────────────────────────────────────
router.get("/auth/check-username", async (req, res): Promise<void> => {
  const username = (req.query.username as string ?? "").trim().toLowerCase();
  if (!username || username.length < 3) {
    res.json({ available: false, reason: "too_short" });
    return;
  }
  if (!/^[a-z0-9_]+$/.test(username)) {
    res.json({ available: false, reason: "invalid_chars" });
    return;
  }
  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1);
  res.json({ available: existing.length === 0 });
});

export default router;
