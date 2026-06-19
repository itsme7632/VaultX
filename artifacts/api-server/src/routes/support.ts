import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, supportTicketsTable, supportMessagesTable, usersTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/support/tickets", requireAuth, async (req, res): Promise<void> => {
  const isAdmin = req.session.isAdmin;

  const tickets = isAdmin
    ? await db
        .select({ ticket: supportTicketsTable, username: usersTable.username, fullName: usersTable.fullName })
        .from(supportTicketsTable)
        .leftJoin(usersTable, eq(supportTicketsTable.userId, usersTable.id))
        .orderBy(desc(supportTicketsTable.updatedAt))
        .limit(50)
    : await db
        .select({ ticket: supportTicketsTable, username: usersTable.username, fullName: usersTable.fullName })
        .from(supportTicketsTable)
        .leftJoin(usersTable, eq(supportTicketsTable.userId, usersTable.id))
        .where(eq(supportTicketsTable.userId, req.session.userId!))
        .orderBy(desc(supportTicketsTable.updatedAt));

  res.json(tickets.map((t) => ({
    id: t.ticket.id,
    userId: t.ticket.userId,
    username: t.username,
    fullName: t.fullName,
    subject: t.ticket.subject,
    status: t.ticket.status,
    priority: t.ticket.priority,
    createdAt: t.ticket.createdAt,
    updatedAt: t.ticket.updatedAt,
  })));
});

router.post("/support/tickets", requireAuth, async (req, res): Promise<void> => {
  const { subject, message } = req.body;

  if (!subject || !message) {
    res.status(400).json({ error: "Subject and message required" });
    return;
  }

  const [ticket] = await db
    .insert(supportTicketsTable)
    .values({
      userId: req.session.userId!,
      subject,
      status: "open",
    })
    .returning();

  await db.insert(supportMessagesTable).values({
    ticketId: ticket.id,
    userId: req.session.userId!,
    isAdmin: false,
    message,
  });

  res.status(201).json({
    id: ticket.id,
    subject: ticket.subject,
    status: ticket.status,
    createdAt: ticket.createdAt,
  });
});

router.get("/support/tickets/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [ticket] = await db
    .select()
    .from(supportTicketsTable)
    .where(eq(supportTicketsTable.id, id))
    .limit(1);

  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  if (!req.session.isAdmin && ticket.userId !== req.session.userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const messages = await db
    .select()
    .from(supportMessagesTable)
    .where(eq(supportMessagesTable.ticketId, id))
    .orderBy(supportMessagesTable.createdAt);

  res.json({
    id: ticket.id,
    subject: ticket.subject,
    status: ticket.status,
    priority: ticket.priority,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    messages: messages.map((m) => ({
      id: m.id,
      isAdmin: m.isAdmin,
      message: m.message,
      createdAt: m.createdAt,
    })),
  });
});

router.post("/support/tickets/:id/reply", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { message } = req.body;

  if (!message) {
    res.status(400).json({ error: "Message required" });
    return;
  }

  const [ticket] = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, id)).limit(1);
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  if (!req.session.isAdmin && ticket.userId !== req.session.userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [msg] = await db
    .insert(supportMessagesTable)
    .values({
      ticketId: id,
      userId: req.session.userId!,
      isAdmin: req.session.isAdmin ?? false,
      message,
    })
    .returning();

  await db
    .update(supportTicketsTable)
    .set({ updatedAt: new Date(), status: req.session.isAdmin ? "answered" : "open" })
    .where(eq(supportTicketsTable.id, id));

  res.status(201).json({
    id: msg.id,
    isAdmin: msg.isAdmin,
    message: msg.message,
    createdAt: msg.createdAt,
  });
});

router.post("/support/tickets/:id/close", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [ticket] = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, id)).limit(1);
  if (!ticket) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (!req.session.isAdmin && ticket.userId !== req.session.userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db
    .update(supportTicketsTable)
    .set({ status: "closed", closedAt: new Date(), updatedAt: new Date() })
    .where(eq(supportTicketsTable.id, id));

  res.json({ success: true });
});

router.post("/support/tickets/:id/reopen", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [ticket] = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, id)).limit(1);
  if (!ticket) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (!req.session.isAdmin && ticket.userId !== req.session.userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db
    .update(supportTicketsTable)
    .set({ status: "open", updatedAt: new Date() })
    .where(eq(supportTicketsTable.id, id));

  res.json({ success: true });
});

export default router;
