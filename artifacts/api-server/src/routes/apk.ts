import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, appReleasesTable } from "@workspace/db";
import { requireAdmin } from "../middlewares/auth";
import { requireAuth } from "../middlewares/auth";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorage = new ObjectStorageService();

// ─── Admin: get presigned upload URL ───────────────────────────────────────
router.post("/admin/apk/upload-url", requireAdmin, async (req, res): Promise<void> => {
  try {
    const uploadURL = await objectStorage.getObjectEntityUploadURL();
    const objectPath = objectStorage.normalizeObjectEntityPath(uploadURL);
    res.json({ uploadURL, objectPath });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

// ─── Admin: save APK metadata after upload ─────────────────────────────────
router.post("/admin/apk", requireAdmin, async (req, res): Promise<void> => {
  const { version, fileName, fileSize, objectPath, releaseNotes } = req.body;
  if (!version || !fileName || !fileSize || !objectPath) {
    res.status(400).json({ error: "version, fileName, fileSize and objectPath required" });
    return;
  }

  // Deactivate all previous releases
  await db.update(appReleasesTable).set({ isActive: false });

  // Insert the new release as active
  const [release] = await db.insert(appReleasesTable).values({
    version,
    fileName,
    fileSize: parseInt(fileSize),
    objectPath,
    releaseNotes: releaseNotes || null,
    isActive: true,
  }).returning();

  res.json(release);
});

// ─── Admin: list all APK releases ──────────────────────────────────────────
router.get("/admin/apk", requireAdmin, async (_req, res): Promise<void> => {
  const releases = await db
    .select()
    .from(appReleasesTable)
    .orderBy(desc(appReleasesTable.uploadedAt));
  res.json(releases);
});

// ─── Admin: delete a release ───────────────────────────────────────────────
router.delete("/admin/apk/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [deleted] = await db.delete(appReleasesTable).where(eq(appReleasesTable.id, id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Release not found" });
    return;
  }
  res.json({ success: true });
});

// ─── Admin: toggle active release ──────────────────────────────────────────
router.post("/admin/apk/:id/activate", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  await db.update(appReleasesTable).set({ isActive: false });
  const [updated] = await db.update(appReleasesTable)
    .set({ isActive: true })
    .where(eq(appReleasesTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Release not found" });
    return;
  }
  res.json(updated);
});

// ─── Public: latest APK info ───────────────────────────────────────────────
router.get("/apk/latest", async (_req, res): Promise<void> => {
  const [release] = await db
    .select()
    .from(appReleasesTable)
    .where(eq(appReleasesTable.isActive, true))
    .limit(1);
  if (!release) {
    res.status(404).json({ error: "No active release found" });
    return;
  }
  res.json({
    id: release.id,
    version: release.version,
    fileName: release.fileName,
    fileSize: release.fileSize,
    releaseNotes: release.releaseNotes,
    uploadedAt: release.uploadedAt,
  });
});

// ─── Auth-required: download latest active APK ────────────────────────────
router.get("/apk/download", requireAuth, async (req, res): Promise<void> => {
  const [release] = await db
    .select()
    .from(appReleasesTable)
    .where(eq(appReleasesTable.isActive, true))
    .limit(1);

  if (!release) {
    res.status(404).json({ error: "No active APK release available" });
    return;
  }

  try {
    const file = await objectStorage.getObjectEntityFile(release.objectPath);
    const response = await objectStorage.downloadObject(file, 0);

    res.setHeader("Content-Disposition", `attachment; filename="${release.fileName}"`);
    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    if (release.fileSize) res.setHeader("Content-Length", release.fileSize);

    const { Readable } = await import("stream");
    const body = response.body;
    if (!body) {
      res.status(500).json({ error: "Failed to stream file" });
      return;
    }
    Readable.fromWeb(body as any).pipe(res);
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "APK file not found in storage" });
    } else {
      res.status(500).json({ error: "Failed to download APK" });
    }
  }
});

export default router;
