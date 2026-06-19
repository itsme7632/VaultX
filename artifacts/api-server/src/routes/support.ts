import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, supportTicketsTable, supportMessagesTable, usersTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const router: IRouter = Router();

const SUPPORT_IMAGES_DIR = path.resolve(process.cwd(), "../../storage/support-images");

async function ensureSupportImagesDir() {
  await fs.mkdir(SUPPORT_IMAGES_DIR, { recursive: true });
}

// ─── Upload attachment ─────────────────────────────────────────────────────
router.post("/support/upload-image", requireAuth, async (req, res): Promise<void> => {
  try {
    const { base64, mimeType } = req.body as { base64?: string; mimeType?: string };
    if (!base64 || !mimeType) {
      res.status(400).json({ error: "base64 and mimeType required" });
      return;
    }
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowed.includes(mimeType)) {
      res.status(400).json({ error: "Only JPG, PNG, WEBP images are allowed" });
      return;
    }
    const buffer = Buffer.from(base64, "base64");
    if (buffer.length > 5 * 1024 * 1024) {
      res.status(400).json({ error: "Image exceeds 5MB limit" });
      return;
    }
    const ext = mimeType.split("/")[1].replace("jpeg", "jpg");
    const id = crypto.randomUUID().replace(/-/g, "");
    const filename = `${id}.${ext}`;
    await ensureSupportImagesDir();
    await fs.writeFile(path.join(SUPPORT_IMAGES_DIR, filename), buffer);
    res.json({ url: `/api/support/images/${filename}` });
  } catch (e: any) {
    res.status(500).json({ error: e.message ?? "Upload failed" });
  }
});

// ─── Serve attachment ──────────────────────────────────────────────────────
router.get("/support/images/:filename", requireAuth, async (req, res): Promise<void> => {
  const { filename } = req.params;
  if (!/^[a-f0-9]+\.(jpg|png|webp)$/i.test(filename)) {
    res.status(400).json({ error: "Invalid filename" }); return;
  }
  const filePath = path.join(SUPPORT_IMAGES_DIR, filename);
  try {
    await fs.access(filePath);
    const ext = filename.split(".").pop()!.toLowerCase();
    const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    res.setHeader("Content-Type", mime);
    res.setHeader("Cache-Control", "public, max-age=86400");
    const buf = await fs.readFile(filePath);
    res.send(buf);
  } catch {
    res.status(404).json({ error: "Not found" });
  }
});

// ─── List tickets ──────────────────────────────────────────────────────────
router.get("/support/tickets", requireAuth, async (req, res): Promise<void> => {
  const isAdmin = req.session.isAdmin;
  const tickets = isAdmin
    ? await db.select({ ticket: supportTicketsTable, username: usersTable.username, fullName: usersTable.fullName })
        .from(supportTicketsTable)
        .leftJoin(usersTable, eq(supportTicketsTable.userId, usersTable.id))
        .orderBy(desc(supportTicketsTable.updatedAt))
        .limit(50)
    : await db.select({ ticket: supportTicketsTable, username: usersTable.username, fullName: usersTable.fullName })
        .from(supportTicketsTable)
        .leftJoin(usersTable, eq(supportTicketsTable.userId, usersTable.id))
        .where(eq(supportTicketsTable.userId, req.session.userId!))
        .orderBy(desc(supportTicketsTable.updatedAt));

  res.json(tickets.map((t) => ({
    id: t.ticket.id, userId: t.ticket.userId, username: t.username,
    fullName: t.fullName, subject: t.ticket.subject, status: t.ticket.status,
    priority: t.ticket.priority, createdAt: t.ticket.createdAt, updatedAt: t.ticket.updatedAt,
  })));
});

// ─── Create ticket ─────────────────────────────────────────────────────────
router.post("/support/tickets", requireAuth, async (req, res): Promise<void> => {
  const { subject, message, imageUrl } = req.body;
  if (!subject || !message) { res.status(400).json({ error: "Subject and message required" }); return; }

  const [ticket] = await db.insert(supportTicketsTable).values({
    userId: req.session.userId!, subject, status: "open",
  }).returning();

  const msgBody = imageUrl
    ? JSON.stringify({ text: message, imageUrl })
    : message;

  await db.insert(supportMessagesTable).values({
    ticketId: ticket.id, userId: req.session.userId!, isAdmin: false, message: msgBody,
  });

  res.status(201).json({ id: ticket.id, subject: ticket.subject, status: ticket.status, createdAt: ticket.createdAt });
});

// ─── Get ticket detail ─────────────────────────────────────────────────────
router.get("/support/tickets/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

  const [ticket] = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, id)).limit(1);
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }
  if (!req.session.isAdmin && ticket.userId !== req.session.userId) { res.status(403).json({ error: "Forbidden" }); return; }

  const messages = await db.select().from(supportMessagesTable)
    .where(eq(supportMessagesTable.ticketId, id))
    .orderBy(supportMessagesTable.createdAt);

  res.json({
    id: ticket.id, subject: ticket.subject, status: ticket.status,
    priority: ticket.priority, createdAt: ticket.createdAt, updatedAt: ticket.updatedAt,
    messages: messages.map((m) => {
      let text = m.message;
      let imageUrl: string | null = null;
      try {
        const parsed = JSON.parse(m.message);
        if (parsed && typeof parsed === "object") {
          text = parsed.text ?? "";
          imageUrl = parsed.imageUrl ?? null;
        }
      } catch {}
      return { id: m.id, isAdmin: m.isAdmin, message: text, imageUrl, createdAt: m.createdAt };
    }),
  });
});

// ─── Reply to ticket ───────────────────────────────────────────────────────
router.post("/support/tickets/:id/reply", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { message, imageUrl } = req.body;

  if (!message && !imageUrl) { res.status(400).json({ error: "Message or image required" }); return; }

  const [ticket] = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, id)).limit(1);
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }
  if (!req.session.isAdmin && ticket.userId !== req.session.userId) { res.status(403).json({ error: "Forbidden" }); return; }

  const msgBody = imageUrl
    ? JSON.stringify({ text: message ?? "", imageUrl })
    : (message ?? "");

  const [msg] = await db.insert(supportMessagesTable).values({
    ticketId: id, userId: req.session.userId!,
    isAdmin: req.session.isAdmin ?? false,
    message: msgBody,
  }).returning();

  await db.update(supportTicketsTable)
    .set({ updatedAt: new Date(), status: req.session.isAdmin ? "answered" : "open" })
    .where(eq(supportTicketsTable.id, id));

  res.status(201).json({ id: msg.id, isAdmin: msg.isAdmin, message: message ?? "", imageUrl: imageUrl ?? null, createdAt: msg.createdAt });
});

// ─── Close ticket ──────────────────────────────────────────────────────────
router.post("/support/tickets/:id/close", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [ticket] = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, id)).limit(1);
  if (!ticket) { res.status(404).json({ error: "Not found" }); return; }
  if (!req.session.isAdmin && ticket.userId !== req.session.userId) { res.status(403).json({ error: "Forbidden" }); return; }
  await db.update(supportTicketsTable).set({ status: "closed", closedAt: new Date(), updatedAt: new Date() }).where(eq(supportTicketsTable.id, id));
  res.json({ success: true });
});

// ─── Reopen ticket ─────────────────────────────────────────────────────────
router.post("/support/tickets/:id/reopen", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [ticket] = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, id)).limit(1);
  if (!ticket) { res.status(404).json({ error: "Not found" }); return; }
  if (!req.session.isAdmin && ticket.userId !== req.session.userId) { res.status(403).json({ error: "Forbidden" }); return; }
  await db.update(supportTicketsTable).set({ status: "open", updatedAt: new Date() }).where(eq(supportTicketsTable.id, id));
  res.json({ success: true });
});

export default router;
