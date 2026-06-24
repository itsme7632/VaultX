import { promises as fs } from "fs";
import path from "path";
import { createReadStream, type ReadStream } from "fs";

// Store APK files at workspace root level: /home/runner/workspace/storage/apk
// This survives server rebuilds and is outside the artifact build directory
const APK_STORAGE_DIR = path.resolve(process.cwd(), "../../storage/apk");

// ─── Community image storage ────────────────────────────────────────────────
// Stored at /home/runner/workspace/storage/community-images — persists across restarts

const COMMUNITY_IMAGES_DIR = path.resolve(process.cwd(), "../../storage/community-images");

export async function ensureCommunityImagesDir(): Promise<string> {
  await fs.mkdir(COMMUNITY_IMAGES_DIR, { recursive: true });
  return COMMUNITY_IMAGES_DIR;
}

export function getCommunityImagePath(filename: string): string {
  // Prevent path traversal: strip any directory components
  const safe = path.basename(filename);
  return path.join(COMMUNITY_IMAGES_DIR, safe);
}

export async function saveCommunityImage(buffer: Buffer, filename: string): Promise<string> {
  await ensureCommunityImagesDir();
  const filePath = getCommunityImagePath(filename);
  await fs.writeFile(filePath, buffer);
  const stat = await fs.stat(filePath);
  if (stat.size !== buffer.length) {
    throw new Error(`Write verification failed: expected ${buffer.length} bytes, got ${stat.size}`);
  }
  return filePath;
}

export async function communityImageExists(filename: string): Promise<boolean> {
  try {
    await fs.access(getCommunityImagePath(filename));
    return true;
  } catch {
    return false;
  }
}

export function openCommunityImageStream(filename: string): ReadStream {
  return createReadStream(getCommunityImagePath(filename));
}

export async function deleteCommunityImage(filename: string): Promise<void> {
  try {
    await fs.unlink(getCommunityImagePath(filename));
  } catch (err: any) {
    if (err.code !== "ENOENT") throw err;
  }
}

export function getCommunityImagesDir(): string {
  return COMMUNITY_IMAGES_DIR;
}

export async function ensureApkDir(): Promise<string> {
  await fs.mkdir(APK_STORAGE_DIR, { recursive: true });
  return APK_STORAGE_DIR;
}

export function getApkFilePath(fileId: string): string {
  return path.join(APK_STORAGE_DIR, fileId);
}

export async function saveApkFile(buffer: Buffer, fileId: string): Promise<string> {
  await ensureApkDir();
  const filePath = getApkFilePath(fileId);
  await fs.writeFile(filePath, buffer);
  const stat = await fs.stat(filePath);
  if (stat.size !== buffer.length) {
    throw new Error(`Write verification failed: expected ${buffer.length} bytes, got ${stat.size}`);
  }
  return filePath;
}

export async function apkFileExists(fileId: string): Promise<boolean> {
  try {
    await fs.access(getApkFilePath(fileId));
    return true;
  } catch {
    return false;
  }
}

export function openApkReadStream(fileId: string): ReadStream {
  return createReadStream(getApkFilePath(fileId));
}

export async function deleteApkFile(fileId: string): Promise<void> {
  try {
    await fs.unlink(getApkFilePath(fileId));
  } catch (err: any) {
    if (err.code !== "ENOENT") throw err;
  }
}

export function getApkStorageDir(): string {
  return APK_STORAGE_DIR;
}

export async function getApkFileStat(fileId: string): Promise<{ size: number; mtime: Date } | null> {
  try {
    const s = await fs.stat(getApkFilePath(fileId));
    return { size: s.size, mtime: s.mtime };
  } catch {
    return null;
  }
}
