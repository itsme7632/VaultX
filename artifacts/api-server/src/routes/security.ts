import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import speakeasy from "speakeasy";
import { eq, and } from "drizzle-orm";
import { db, usersTable, withdrawalAddressesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function maskAddress(addr: string): string {
  if (addr.length <= 10) return addr;
  return addr.slice(0, 4) + "****" + addr.slice(-4);
}

router.get("/security/status", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId!))
    .limit(1);

  const addresses = await db
    .select()
    .from(withdrawalAddressesTable)
    .where(eq(withdrawalAddressesTable.userId, req.session.userId!));

  res.json({
    twoFaEnabled: user.twoFaEnabled,
    hasWithdrawalPassword: !!user.withdrawalPasswordHash,
    withdrawalAddresses: addresses.map((a) => ({
      id: a.id,
      network: a.network,
      address: a.address,
      label: a.label,
      maskedAddress: maskAddress(a.address),
      createdAt: a.createdAt,
    })),
    allConfigured: user.twoFaEnabled && !!user.withdrawalPasswordHash && addresses.length > 0,
  });
});

router.post("/security/withdrawal-password/set", requireAuth, async (req, res): Promise<void> => {
  const { password, confirmPassword } = req.body;

  if (!password || !confirmPassword) {
    res.status(400).json({ error: "Missing fields", message: "All fields are required" });
    return;
  }
  if (password !== confirmPassword) {
    res.status(400).json({ error: "Mismatch", message: "Passwords do not match" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "Too short", message: "Withdrawal password must be at least 6 characters" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId!))
    .limit(1);

  if (user.withdrawalPasswordHash) {
    res.status(400).json({ error: "Already set", message: "Withdrawal password already set. Use the change endpoint instead." });
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  await db
    .update(usersTable)
    .set({ withdrawalPasswordHash: hash })
    .where(eq(usersTable.id, req.session.userId!));

  res.json({ success: true, message: "Withdrawal password set successfully" });
});

router.post("/security/withdrawal-password/change", requireAuth, async (req, res): Promise<void> => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (!currentPassword || !newPassword || !confirmPassword) {
    res.status(400).json({ error: "Missing fields", message: "All fields are required" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId!))
    .limit(1);

  if (!user.withdrawalPasswordHash) {
    res.status(400).json({ error: "Not set", message: "No withdrawal password is set. Use the set endpoint first." });
    return;
  }

  const valid = await bcrypt.compare(currentPassword, user.withdrawalPasswordHash);
  if (!valid) {
    res.status(400).json({ error: "Wrong password", message: "Current withdrawal password is incorrect" });
    return;
  }

  if (newPassword !== confirmPassword) {
    res.status(400).json({ error: "Mismatch", message: "New passwords do not match" });
    return;
  }
  if (newPassword.length < 6) {
    res.status(400).json({ error: "Too short", message: "Withdrawal password must be at least 6 characters" });
    return;
  }

  const hash = await bcrypt.hash(newPassword, 12);
  await db
    .update(usersTable)
    .set({ withdrawalPasswordHash: hash })
    .where(eq(usersTable.id, req.session.userId!));

  res.json({ success: true, message: "Withdrawal password changed successfully" });
});

router.get("/security/addresses", requireAuth, async (req, res): Promise<void> => {
  const addresses = await db
    .select()
    .from(withdrawalAddressesTable)
    .where(eq(withdrawalAddressesTable.userId, req.session.userId!));

  res.json(
    addresses.map((a) => ({
      id: a.id,
      network: a.network,
      address: a.address,
      label: a.label,
      maskedAddress: maskAddress(a.address),
      createdAt: a.createdAt,
    }))
  );
});

router.post("/security/addresses", requireAuth, async (req, res): Promise<void> => {
  const { network, address, label } = req.body;

  if (!network || !address || address.trim().length < 10) {
    res.status(400).json({ error: "Invalid", message: "Network and a valid address (min 10 chars) are required" });
    return;
  }

  const existing = await db
    .select()
    .from(withdrawalAddressesTable)
    .where(eq(withdrawalAddressesTable.userId, req.session.userId!));

  if (existing.length >= 5) {
    res.status(400).json({ error: "Limit reached", message: "Maximum 5 withdrawal addresses allowed" });
    return;
  }

  const duplicate = existing.find((a) => a.address === address.trim() && a.network === network);
  if (duplicate) {
    res.status(400).json({ error: "Duplicate", message: "This address is already saved for that network" });
    return;
  }

  const [addr] = await db
    .insert(withdrawalAddressesTable)
    .values({
      userId: req.session.userId!,
      network: network.trim(),
      address: address.trim(),
      label: (label || "").trim(),
    })
    .returning();

  res.status(201).json({
    id: addr.id,
    network: addr.network,
    address: addr.address,
    label: addr.label,
    maskedAddress: maskAddress(addr.address),
    createdAt: addr.createdAt,
  });
});

router.delete("/security/addresses/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [addr] = await db
    .select()
    .from(withdrawalAddressesTable)
    .where(and(eq(withdrawalAddressesTable.id, id), eq(withdrawalAddressesTable.userId, req.session.userId!)))
    .limit(1);

  if (!addr) {
    res.status(404).json({ error: "Not found", message: "Address not found" });
    return;
  }

  await db.delete(withdrawalAddressesTable).where(eq(withdrawalAddressesTable.id, id));

  res.json({ success: true });
});

export default router;
