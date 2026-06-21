import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function serializeUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
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
    whatsappLocked: user.whatsappLocked,
    createdAt: user.createdAt,
  };
}

router.get("/users/profile", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId!))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(serializeUser(user));
});

router.put("/users/profile", requireAuth, async (req, res): Promise<void> => {
  const { fullName, whatsapp, country, avatarUrl } = req.body;

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId!))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const updateData: Partial<typeof usersTable.$inferInsert> = {};
  if (fullName) updateData.fullName = fullName;
  if (country) updateData.country = country;
  if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

  if (whatsapp !== undefined) {
    if (existing.whatsappLocked) {
      res.status(400).json({ error: "Locked", message: "WhatsApp number cannot be changed. Contact support." });
      return;
    }
    updateData.whatsapp = whatsapp || null;
    if (whatsapp) updateData.whatsappLocked = true;
  }

  const [user] = await db
    .update(usersTable)
    .set(updateData)
    .where(eq(usersTable.id, req.session.userId!))
    .returning();

  res.json(serializeUser(user));
});

router.post("/users/change-password", requireAuth, async (req, res): Promise<void> => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (!currentPassword || !newPassword || !confirmPassword) {
    res.status(400).json({ error: "Missing fields", message: "All fields are required" });
    return;
  }

  if (newPassword !== confirmPassword) {
    res.status(400).json({ error: "Mismatch", message: "New passwords do not match" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId!))
    .limit(1);

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    res.status(400).json({ error: "Wrong password", message: "Current password is incorrect" });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db
    .update(usersTable)
    .set({ passwordHash })
    .where(eq(usersTable.id, req.session.userId!));

  res.json({ success: true, message: "Password changed successfully" });
});

router.post("/2fa/setup", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId!))
    .limit(1);

  const secret = speakeasy.generateSecret({
    name: `Wexora (${user.email})`,
    issuer: "Wexora",
  });

  await db
    .update(usersTable)
    .set({ twoFaSecret: secret.base32 })
    .where(eq(usersTable.id, req.session.userId!));

  const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

  res.json({
    secret: secret.base32,
    qrCodeUrl,
    otpAuthUrl: secret.otpauth_url,
  });
});

router.post("/2fa/verify", requireAuth, async (req, res): Promise<void> => {
  const { code } = req.body;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId!))
    .limit(1);

  if (!user.twoFaSecret) {
    res.status(400).json({ error: "No secret", message: "Set up 2FA first" });
    return;
  }

  const verified = speakeasy.totp.verify({
    secret: user.twoFaSecret,
    encoding: "base32",
    token: code,
    window: 1,
  });

  if (!verified) {
    res.status(400).json({ error: "Invalid code", message: "The verification code is incorrect" });
    return;
  }

  await db
    .update(usersTable)
    .set({ twoFaEnabled: true })
    .where(eq(usersTable.id, req.session.userId!));

  const backupCodes = Array.from({ length: 8 }, () =>
    Math.random().toString(36).substring(2, 10).toUpperCase()
  );

  res.json({ enabled: true, backupCodes });
});

router.post("/2fa/disable", requireAuth, async (req, res): Promise<void> => {
  const { code } = req.body;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId!))
    .limit(1);

  if (!user.twoFaSecret) {
    res.status(400).json({ error: "Not enabled", message: "2FA is not enabled" });
    return;
  }

  const verified = speakeasy.totp.verify({
    secret: user.twoFaSecret,
    encoding: "base32",
    token: code,
    window: 1,
  });

  if (!verified) {
    res.status(400).json({ error: "Invalid code", message: "Verification code is incorrect" });
    return;
  }

  await db
    .update(usersTable)
    .set({ twoFaEnabled: false, twoFaSecret: null })
    .where(eq(usersTable.id, req.session.userId!));

  res.json({ success: true, message: "2FA has been disabled" });
});

export default router;
