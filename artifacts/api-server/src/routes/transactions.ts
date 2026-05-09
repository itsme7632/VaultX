import { Router, type IRouter } from "express";
import { eq, and, desc, ilike, SQL } from "drizzle-orm";
import { db, transactionsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/transactions", requireAuth, async (req, res): Promise<void> => {
  const {
    type,
    status,
    search,
    limit = "20",
    offset = "0",
  } = req.query as Record<string, string>;

  const conditions: SQL[] = [eq(transactionsTable.userId, req.session.userId!)];

  if (type) conditions.push(eq(transactionsTable.type, type));
  if (status) conditions.push(eq(transactionsTable.status, status));
  if (search) conditions.push(ilike(transactionsTable.txHash, `%${search}%`));

  const items = await db
    .select()
    .from(transactionsTable)
    .where(and(...conditions))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(parseInt(limit, 10))
    .offset(parseInt(offset, 10));

  res.json({
    items: items.map((t) => ({
      id: t.id,
      type: t.type,
      amount: parseFloat(t.amount),
      status: t.status,
      network: t.network,
      txHash: t.txHash,
      address: t.address,
      note: t.note,
      createdAt: t.createdAt,
    })),
    total: items.length,
  });
});

router.get("/wallet/transactions/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid transaction ID" });
    return;
  }

  const [tx] = await db
    .select()
    .from(transactionsTable)
    .where(and(eq(transactionsTable.id, id), eq(transactionsTable.userId, req.session.userId!)))
    .limit(1);

  if (!tx) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }

  let metadata: Record<string, string> | null = null;
  try { if (tx.metadata) metadata = JSON.parse(tx.metadata); } catch {}

  res.json({
    id: tx.id,
    type: tx.type,
    amount: parseFloat(tx.amount),
    fee: parseFloat(tx.fee ?? "0"),
    status: tx.status,
    network: tx.network,
    txHash: tx.txHash,
    address: tx.address,
    note: tx.note,
    metadata,
    createdAt: tx.createdAt,
    updatedAt: tx.updatedAt,
  });
});

export default router;
