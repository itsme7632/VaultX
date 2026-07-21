import { Router, type IRouter } from "express";
import multer from "multer";
import { eq, desc, sql } from "drizzle-orm";
import { db, appReleasesTable } from "@workspace/db";
import { requireAdmin, requireAuth } from "../middlewares/auth";
import { randomUUID } from "crypto";
import {
  saveApkFile,
  apkFileExists,
  openApkReadStream,
  deleteApkFile,
  getApkFilePath,
  getApkStorageDir,
  getApkFileStat,
} from "../lib/localFileStorage";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
});

function extractFileId(objectPath: string): string {
  return objectPath.split("/").pop() ?? objectPath;
}

// ─── Admin: upload APK ─────────────────────────────────────────────────────
router.post(
  "/admin/apk/upload",
  requireAdmin,
  upload.single("apk"),
  async (req, res): Promise<void> => {
    const file = req.file;
    const { version, releaseNotes } = req.body;

    if (!file) {
      res.status(400).json({ error: "APK file is required" });
      return;
    }
    if (!version?.trim()) {
      res.status(400).json({ error: "Version is required" });
      return;
    }

    const fileId = randomUUID();
    const objectPath = `/objects/apk/${fileId}`;

    try {
      const savedPath = await saveApkFile(file.buffer, fileId);
      console.log(`[APK] Saved ${file.originalname} (${file.size} bytes) to ${savedPath}`);

      await db.update(appReleasesTable).set({ isActive: false });

      const [release] = await db
        .insert(appReleasesTable)
        .values({
          version: version.trim(),
          fileName: file.originalname,
          fileSize: file.size,
          objectPath,
          releaseNotes: releaseNotes?.trim() || null,
          isActive: true,
          uploadedBy: (req.session as any)?.username ?? "admin",
          downloadCount: 0,
        })
        .returning();

      console.log(`[APK] Release created id=${release.id} version=${release.version}`);
      res.json(release);
    } catch (err: any) {
      console.error("[APK] Upload error:", err);
      res.status(500).json({ error: "Upload failed: " + (err.message ?? "Unknown error") });
    }
  }
);

// ─── Admin: list all releases ──────────────────────────────────────────────
router.get("/admin/apk", requireAdmin, async (_req, res): Promise<void> => {
  const releases = await db
    .select()
    .from(appReleasesTable)
    .orderBy(desc(appReleasesTable.uploadedAt));
  res.json(releases);
});

// ─── Admin: diagnostics ────────────────────────────────────────────────────
router.get("/admin/apk/diagnostic", requireAdmin, async (_req, res): Promise<void> => {
  const releases = await db
    .select()
    .from(appReleasesTable)
    .orderBy(desc(appReleasesTable.uploadedAt));

  const storageDir = getApkStorageDir();

  const items = await Promise.all(
    releases.map(async (r) => {
      const fileId = extractFileId(r.objectPath);
      const filePath = getApkFilePath(fileId);
      const stat = await getApkFileStat(fileId);
      return {
        id: r.id,
        version: r.version,
        fileName: r.fileName,
        fileSize: r.fileSize,
        objectPath: r.objectPath,
        filePath,
        existsOnDisk: stat !== null,
        diskSize: stat?.size ?? null,
        isActive: r.isActive,
        uploadedAt: r.uploadedAt,
        downloadCount: r.downloadCount,
      };
    })
  );

  res.json({ storageDir, releases: items });
});

// ─── Admin: activate a release ─────────────────────────────────────────────
router.post("/admin/apk/:id/activate", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  await db.update(appReleasesTable).set({ isActive: false });
  const [updated] = await db
    .update(appReleasesTable)
    .set({ isActive: true })
    .where(eq(appReleasesTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Release not found" });
    return;
  }
  res.json(updated);
});

// ─── Admin: deactivate a release ───────────────────────────────────────────
router.post("/admin/apk/:id/deactivate", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [updated] = await db
    .update(appReleasesTable)
    .set({ isActive: false })
    .where(eq(appReleasesTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Release not found" });
    return;
  }
  res.json(updated);
});

// ─── Admin: delete a release ───────────────────────────────────────────────
router.delete("/admin/apk/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [deleted] = await db
    .delete(appReleasesTable)
    .where(eq(appReleasesTable.id, id))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Release not found" });
    return;
  }
  const fileId = extractFileId(deleted.objectPath);
  try {
    await deleteApkFile(fileId);
    console.log(`[APK] Deleted file ${fileId} from storage`);
  } catch (err) {
    console.warn("[APK] Could not delete file:", (err as Error).message);
  }
  res.json({ success: true });
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
    downloadCount: release.downloadCount,
  });
});

// ─── Auth-required: download active APK ──────────────────────────────────
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

  const fileId = extractFileId(release.objectPath);
  const exists = await apkFileExists(fileId);

  if (!exists) {
    console.error(`[APK] File missing on disk: fileId=${fileId} objectPath=${release.objectPath} storagePath=${getApkFilePath(fileId)}`);
    res.status(404).json({
      error: "APK file is not available on this server. Please ask the admin to re-upload the APK.",
    });
    return;
  }

  const safeFileName = release.fileName.replace(/[^a-zA-Z0-9._\-()]/g, "_");

  res.setHeader("Content-Type", "application/vnd.android.package-archive");
  res.setHeader("Content-Disposition", `attachment; filename="${safeFileName}"`);
  res.setHeader("Content-Length", String(release.fileSize));
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store");

  db.update(appReleasesTable)
    .set({ downloadCount: sql`${appReleasesTable.downloadCount} + 1` })
    .where(eq(appReleasesTable.id, release.id))
    .execute()
    .catch((e: Error) => console.warn("[APK] download count increment failed:", e.message));

  const stream = openApkReadStream(fileId);

  stream.on("error", (err) => {
    console.error("[APK] Read stream error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to stream APK file" });
    } else {
      res.destroy();
    }
  });

  stream.pipe(res);
});

export default router;
