import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, newsPostsTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/news", async (req, res): Promise<void> => {
  const { category, limit = "20", offset = "0" } = req.query as Record<string, string>;

  const conditions = [eq(newsPostsTable.isPublished, true)];
  if (category) conditions.push(eq(newsPostsTable.category, category));

  const posts = await db
    .select()
    .from(newsPostsTable)
    .where(and(...conditions))
    .orderBy(desc(newsPostsTable.publishedAt))
    .limit(parseInt(limit, 10))
    .offset(parseInt(offset, 10));

  res.json(posts.map((p) => ({
    id: p.id,
    title: p.title,
    excerpt: p.excerpt,
    content: p.content,
    category: p.category,
    imageUrl: p.imageUrl,
    isFeatured: p.isFeatured,
    publishedAt: p.publishedAt,
    createdAt: p.createdAt,
  })));
});

router.get("/news/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [post] = await db
    .select()
    .from(newsPostsTable)
    .where(and(eq(newsPostsTable.id, id), eq(newsPostsTable.isPublished, true)))
    .limit(1);

  if (!post) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json({
    id: post.id,
    title: post.title,
    excerpt: post.excerpt,
    content: post.content,
    category: post.category,
    imageUrl: post.imageUrl,
    isFeatured: post.isFeatured,
    publishedAt: post.publishedAt,
    createdAt: post.createdAt,
  });
});

router.get("/admin/news", requireAdmin, async (req, res): Promise<void> => {
  const { limit = "50", offset = "0" } = req.query as Record<string, string>;

  const posts = await db
    .select()
    .from(newsPostsTable)
    .orderBy(desc(newsPostsTable.createdAt))
    .limit(parseInt(limit, 10))
    .offset(parseInt(offset, 10));

  res.json(posts.map((p) => ({
    id: p.id,
    title: p.title,
    excerpt: p.excerpt,
    content: p.content,
    category: p.category,
    imageUrl: p.imageUrl,
    isFeatured: p.isFeatured,
    isPublished: p.isPublished,
    publishedAt: p.publishedAt,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  })));
});

router.post("/admin/news", requireAdmin, async (req, res): Promise<void> => {
  const { title, content, excerpt, category, imageUrl, isFeatured, isPublished } = req.body;

  if (!title || !content) {
    res.status(400).json({ error: "Title and content required" });
    return;
  }

  const [post] = await db
    .insert(newsPostsTable)
    .values({
      title,
      content,
      excerpt: excerpt || content.substring(0, 160),
      category: category || "announcement",
      imageUrl: imageUrl || null,
      isFeatured: isFeatured ?? false,
      isPublished: isPublished ?? false,
      publishedAt: isPublished ? new Date() : null,
      createdBy: req.session.userId!,
    })
    .returning();

  res.status(201).json(post);
});

router.put("/admin/news/:id", requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { title, content, excerpt, category, imageUrl, isFeatured, isPublished } = req.body;

  const [existing] = await db.select().from(newsPostsTable).where(eq(newsPostsTable.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const [updated] = await db
    .update(newsPostsTable)
    .set({
      title: title ?? existing.title,
      content: content ?? existing.content,
      excerpt: excerpt ?? existing.excerpt,
      category: category ?? existing.category,
      imageUrl: imageUrl !== undefined ? imageUrl : existing.imageUrl,
      isFeatured: isFeatured !== undefined ? isFeatured : existing.isFeatured,
      isPublished: isPublished !== undefined ? isPublished : existing.isPublished,
      publishedAt: isPublished && !existing.publishedAt ? new Date() : existing.publishedAt,
      updatedAt: new Date(),
    })
    .where(eq(newsPostsTable.id, id))
    .returning();

  res.json(updated);
});

router.delete("/admin/news/:id", requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  await db.delete(newsPostsTable).where(eq(newsPostsTable.id, id));
  res.json({ success: true });
});

export default router;
