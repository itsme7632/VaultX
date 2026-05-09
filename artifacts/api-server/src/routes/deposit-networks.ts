import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, depositNetworksTable } from "@workspace/db";
import { requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/deposit-networks", async (_req, res): Promise<void> => {
  const networks = await db
    .select()
    .from(depositNetworksTable)
    .where(eq(depositNetworksTable.isActive, true))
    .orderBy(depositNetworksTable.id);

  res.json(networks.map((n) => ({
    id: n.id,
    network: n.network,
    label: n.label,
    walletAddress: n.walletAddress,
    minDeposit: parseFloat(n.minDeposit),
    networkFee: parseFloat(n.networkFee),
    confirmationTime: n.confirmationTime,
  })));
});

router.get("/admin/deposit-networks", requireAdmin, async (_req, res): Promise<void> => {
  const networks = await db
    .select()
    .from(depositNetworksTable)
    .orderBy(depositNetworksTable.id);

  res.json(networks.map((n) => ({
    id: n.id,
    network: n.network,
    label: n.label,
    walletAddress: n.walletAddress,
    minDeposit: parseFloat(n.minDeposit),
    networkFee: parseFloat(n.networkFee),
    confirmationTime: n.confirmationTime,
    isActive: n.isActive,
  })));
});

router.post("/admin/deposit-networks", requireAdmin, async (req, res): Promise<void> => {
  const { network, label, walletAddress, minDeposit, networkFee, confirmationTime } = req.body;

  if (!network || !label || !walletAddress) {
    res.status(400).json({ error: "Network, label, and wallet address required" });
    return;
  }

  const [record] = await db
    .insert(depositNetworksTable)
    .values({
      network: network.toUpperCase(),
      label,
      walletAddress,
      minDeposit: (minDeposit ?? 10).toString(),
      networkFee: (networkFee ?? 1).toString(),
      confirmationTime: confirmationTime || "10-30 minutes",
    })
    .returning();

  res.status(201).json(record);
});

router.put("/admin/deposit-networks/:id", requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { label, walletAddress, minDeposit, networkFee, confirmationTime, isActive } = req.body;

  const [existing] = await db
    .select()
    .from(depositNetworksTable)
    .where(eq(depositNetworksTable.id, id))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const [updated] = await db
    .update(depositNetworksTable)
    .set({
      label: label ?? existing.label,
      walletAddress: walletAddress ?? existing.walletAddress,
      minDeposit: minDeposit !== undefined ? minDeposit.toString() : existing.minDeposit,
      networkFee: networkFee !== undefined ? networkFee.toString() : existing.networkFee,
      confirmationTime: confirmationTime ?? existing.confirmationTime,
      isActive: isActive !== undefined ? isActive : existing.isActive,
      updatedAt: new Date(),
    })
    .where(eq(depositNetworksTable.id, id))
    .returning();

  res.json(updated);
});

export default router;
