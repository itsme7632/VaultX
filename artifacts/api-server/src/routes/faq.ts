import { Router, type IRouter } from "express";
import { eq, asc, and } from "drizzle-orm";
import { db, faqsTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/faqs", requireAuth, async (_req, res): Promise<void> => {
  const faqs = await db
    .select()
    .from(faqsTable)
    .where(eq(faqsTable.isActive, true))
    .orderBy(asc(faqsTable.sortOrder), asc(faqsTable.id));
  res.json(faqs);
});

router.get("/admin/faqs", requireAdmin, async (_req, res): Promise<void> => {
  const faqs = await db
    .select()
    .from(faqsTable)
    .orderBy(asc(faqsTable.sortOrder), asc(faqsTable.id));
  res.json(faqs);
});

router.post("/admin/faqs", requireAdmin, async (req, res): Promise<void> => {
  const { question, answer, category, isActive, sortOrder } = req.body;
  if (!question?.trim()) { res.status(400).json({ error: "Question is required" }); return; }
  if (!answer?.trim()) { res.status(400).json({ error: "Answer is required" }); return; }

  const [faq] = await db
    .insert(faqsTable)
    .values({
      question: question.trim(),
      answer: answer.trim(),
      category: (category || "General").trim(),
      isActive: isActive !== false,
      sortOrder: sortOrder ?? 0,
    })
    .returning();
  res.status(201).json(faq);
});

router.put("/admin/faqs/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { question, answer, category, isActive, sortOrder } = req.body;
  if (!question?.trim()) { res.status(400).json({ error: "Question is required" }); return; }
  if (!answer?.trim()) { res.status(400).json({ error: "Answer is required" }); return; }

  const [updated] = await db
    .update(faqsTable)
    .set({
      question: question.trim(),
      answer: answer.trim(),
      category: (category || "General").trim(),
      isActive: isActive !== false,
      sortOrder: sortOrder ?? 0,
      updatedAt: new Date(),
    })
    .where(eq(faqsTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "FAQ not found" }); return; }
  res.json(updated);
});

router.patch("/admin/faqs/:id/toggle", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [faq] = await db.select().from(faqsTable).where(eq(faqsTable.id, id)).limit(1);
  if (!faq) { res.status(404).json({ error: "FAQ not found" }); return; }

  const [updated] = await db
    .update(faqsTable)
    .set({ isActive: !faq.isActive, updatedAt: new Date() })
    .where(eq(faqsTable.id, id))
    .returning();
  res.json(updated);
});

router.patch("/admin/faqs/reorder", requireAdmin, async (req, res): Promise<void> => {
  const { orders } = req.body as { orders: { id: number; sortOrder: number }[] };
  if (!Array.isArray(orders)) { res.status(400).json({ error: "orders must be an array" }); return; }

  await Promise.all(
    orders.map(({ id, sortOrder }) =>
      db.update(faqsTable).set({ sortOrder, updatedAt: new Date() }).where(eq(faqsTable.id, id))
    )
  );
  res.json({ ok: true });
});

router.delete("/admin/faqs/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [deleted] = await db.delete(faqsTable).where(eq(faqsTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "FAQ not found" }); return; }
  res.json({ ok: true });
});

export default router;
