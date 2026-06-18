import { Router, type IRouter } from "express";
import multer from "multer";
import { eq, desc, sql } from "drizzle-orm";
import { db, appReleasesTable } from "@workspace/db";
import { requireAdmin, requireAuth } from "../middlewares/auth";
import { randomUUID } from "crypto";
import {
  saveApkFile,
  apkFileExists,
  getApkReadStream,
  deleteApkFile,
  ensureApkStorageDir,
} from "../lib/localFileStorage";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
});

function extractFileId(objectPath: string): string {
  return objectPath.split("/").pop() ?? objectPath;
}

async function tryGcsUpload(
  buffer: Buffer,
  fileId: string,
  mimeType: string
): Promise<boolean> {
  const privateDir = process.env.PRIVATE_OBJECT_DIR;
  if (!privateDir) return false;

  try {
    const { Storage } = await import("@google-cloud/storage");
    const { Readable } = await import("stream");

    const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";
    const gcsClient = new Storage({
      credentials: {
        audience: "replit",
        subject_token_type: "access_token",
        token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
        type: "external_account",
        credential_source: {
          url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
          format: { type: "json", subject_token_field_name: "access_token" },
        },
        universe_domain: "googleapis.com",
      },
      projectId: "",
    });

    const dir = privateDir.replace(/\/$/, "").replace(/^\//, "");
    const parts = dir.split("/");
    const bucketName = parts[0];
    const prefix = parts.slice(1).join("/");
    const objectName = prefix ? `${prefix}/apk/${fileId}` : `apk/${fileId}`;

    const bucket = gcsClient.bucket(bucketName);
    const gcsFile = bucket.file(objectName);

    await new Promise<void>((resolve, reject) => {
      const writeStream = gcsFile.createWriteStream({
        metadata: { contentType: mimeType },
        resumable: false,
      });
      writeStream.on("error", reject);
      writeStream.on("finish", resolve);
      Readable.from(buffer).pipe(writeStream);
    });

    return true;
  } catch (err) {
    console.warn("[APK] GCS upload failed, using local filesystem:", (err as Error).message);
    return false;
  }
}

async function tryGcsDownload(objectPath: string): Promise<NodeJS.ReadableStream | null> {
  const privateDir = process.env.PRIVATE_OBJECT_DIR;
  if (!privateDir) return null;

  try {
    const { Storage } = await import("@google-cloud/storage");
    const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";
    const gcsClient = new Storage({
      credentials: {
        audience: "replit",
        subject_token_type: "access_token",
        token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
        type: "external_account",
        credential_source: {
          url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
          format: { type: "json", subject_token_field_name: "access_token" },
        },
        universe_domain: "googleapis.com",
      },
      projectId: "",
    });

    const dir = privateDir.replace(/\/$/, "").replace(/^\//, "");
    const parts = dir.split("/");
    const bucketName = parts[0];
    const prefix = parts.slice(1).join("/");
    const fileId = extractFileId(objectPath);
    const objectName = prefix ? `${prefix}/apk/${fileId}` : `apk/${fileId}`;

    const bucket = gcsClient.bucket(bucketName);
    const gcsFile = bucket.file(objectName);
    const [exists] = await gcsFile.exists();
    if (!exists) return null;

    return gcsFile.createReadStream();
  } catch {
    return null;
  }
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

    try {
      await ensureApkStorageDir();
    } catch (err) {
      console.warn("[APK] Could not ensure storage dir:", (err as Error).message);
    }

    const fileId = randomUUID();
    const objectPath = `/objects/apk/${fileId}`;

    try {
      const gcsOk = await tryGcsUpload(
        file.buffer,
        fileId,
        "application/vnd.android.package-archive"
      );

      if (!gcsOk) {
        await saveApkFile(file.buffer, fileId);
      }

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
          uploadedBy: (req.session as any)?.username ?? null,
          downloadCount: 0,
        })
        .returning();

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

// ─── Admin: activate a release ─────────────────────────────────────────────
router.post("/admin/apk/:id/activate", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
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
  const id = parseInt(req.params.id, 10);
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
  const id = parseInt(req.params.id, 10);
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
  } catch (err) {
    console.warn("[APK] Could not delete file from storage:", (err as Error).message);
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

// ─── Auth-required: download APK ──────────────────────────────────────────
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

  const safeFileName = release.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  res.setHeader("Content-Disposition", `attachment; filename="${safeFileName}"`);
  res.setHeader("Content-Type", "application/vnd.android.package-archive");
  if (release.fileSize) res.setHeader("Content-Length", String(release.fileSize));
  res.setHeader("X-Content-Type-Options", "nosniff");

  db.update(appReleasesTable)
    .set({ downloadCount: sql`${appReleasesTable.downloadCount} + 1` })
    .where(eq(appReleasesTable.id, release.id))
    .execute()
    .catch((e: Error) => console.warn("[APK] download count update failed:", e.message));

  const fileId = extractFileId(release.objectPath);

  const gcsStream = await tryGcsDownload(release.objectPath);
  if (gcsStream) {
    gcsStream.pipe(res);
    return;
  }

  try {
    const localStream = await getApkReadStream(fileId);
    localStream.pipe(res);
  } catch (err) {
    console.error("[APK] Download error:", err);
    if (!res.headersSent) {
      res.status(404).json({ error: "APK file not found in storage" });
    }
  }
});

export default router;
