import { Router, type IRouter } from "express";
import { eq, and, desc, ilike, or, SQL } from "drizzle-orm";
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
  if (search) {
    conditions.push(
      or(
        ilike(transactionsTable.txHash, `%${search}%`),
        ilike(transactionsTable.txId, `%${search}%`)
      ) as SQL
    );
  }

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
      txId: t.txId,
      address: t.address,
      note: t.note,
      createdAt: t.createdAt,
    })),
    total: items.length,
  });
});

export default router;
