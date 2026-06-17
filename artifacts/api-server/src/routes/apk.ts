import { Router, type IRouter } from "express";
import multer from "multer";
import { eq, desc } from "drizzle-orm";
import { db, appReleasesTable } from "@workspace/db";
import { requireAdmin } from "../middlewares/auth";
import { requireAuth } from "../middlewares/auth";
import { objectStorageClient, ObjectNotFoundError } from "../lib/objectStorage";
import { randomUUID } from "crypto";
import { Readable } from "stream";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB max
});

function getBucketAndObject(objectPath: string): { bucketName: string; objectName: string } {
  const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
  if (!privateDir) throw new Error("PRIVATE_OBJECT_DIR not set");
  const dir = privateDir.replace(/\/$/, "");
  const parts = dir.replace(/^\//, "").split("/");
  const bucketName = parts[0];
  const prefix = parts.slice(1).join("/");
  const id = randomUUID();
  const objectName = prefix ? `${prefix}/apk/${id}` : `apk/${id}`;
  return { bucketName, objectName };
}

function objectPathFromBucketAndName(bucketName: string, objectName: string): string {
  return `/objects/apk/${objectName.split("/").pop()}`;
}

// ─── Admin: upload APK file directly to GCS ────────────────────────────────
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
      res.status(400).json({ error: "version is required" });
      return;
    }

    try {
      const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
      if (!privateDir) {
        res.status(500).json({ error: "Object storage not configured (PRIVATE_OBJECT_DIR missing)" });
        return;
      }

      // Parse bucket and build object path
      const dir = privateDir.replace(/\/$/, "");
      const parts = dir.replace(/^\//, "").split("/");
      const bucketName = parts[0];
      const prefix = parts.slice(1).join("/");
      const fileId = randomUUID();
      const objectName = prefix ? `${prefix}/apk/${fileId}` : `apk/${fileId}`;

      // Stream buffer to GCS
      const bucket = objectStorageClient.bucket(bucketName);
      const gcsFile = bucket.file(objectName);

      await new Promise<void>((resolve, reject) => {
        const writeStream = gcsFile.createWriteStream({
          metadata: { contentType: "application/vnd.android.package-archive" },
          resumable: false,
        });
        writeStream.on("error", reject);
        writeStream.on("finish", resolve);
        const readable = Readable.from(file.buffer);
        readable.pipe(writeStream);
      });

      const objectPath = `/objects/apk/${fileId}`;

      // Deactivate all previous releases
      await db.update(appReleasesTable).set({ isActive: false });

      // Insert new release as active
      const [release] = await db.insert(appReleasesTable).values({
        version: version.trim(),
        fileName: file.originalname,
        fileSize: file.size,
        objectPath,
        releaseNotes: releaseNotes?.trim() || null,
        isActive: true,
      }).returning();

      res.json(release);
    } catch (err: any) {
      console.error("APK upload error:", err);
      res.status(500).json({ error: "Upload failed: " + (err.message || "Unknown error") });
    }
  }
);

// ─── Admin: save APK metadata after upload ─────────────────────────────────
router.post("/admin/apk", requireAdmin, async (req, res): Promise<void> => {
  const { version, fileName, fileSize, objectPath, releaseNotes } = req.body;
  if (!version || !fileName || !fileSize || !objectPath) {
    res.status(400).json({ error: "version, fileName, fileSize and objectPath required" });
    return;
  }
  await db.update(appReleasesTable).set({ isActive: false });
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

// ─── Admin: activate a release ─────────────────────────────────────────────
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
    // objectPath is /objects/apk/<uuid>
    const privateDir = (process.env.PRIVATE_OBJECT_DIR || "").replace(/\/$/, "");
    const parts = privateDir.replace(/^\//, "").split("/");
    const bucketName = parts[0];
    const prefix = parts.slice(1).join("/");

    // Reconstruct bucket object name from objectPath
    const fileId = release.objectPath.split("/").pop();
    const objectName = prefix ? `${prefix}/apk/${fileId}` : `apk/${fileId}`;

    const bucket = objectStorageClient.bucket(bucketName);
    const gcsFile = bucket.file(objectName);
    const [exists] = await gcsFile.exists();
    if (!exists) {
      res.status(404).json({ error: "APK file not found in storage" });
      return;
    }

    res.setHeader("Content-Disposition", `attachment; filename="${release.fileName}"`);
    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    if (release.fileSize) res.setHeader("Content-Length", String(release.fileSize));

    gcsFile.createReadStream().pipe(res);
  } catch (err) {
    res.status(500).json({ error: "Failed to download APK" });
  }
});

export default router;
