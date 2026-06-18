import { promises as fs } from "fs";
import path from "path";
import { createReadStream, type ReadStream } from "fs";

// Store APK files at workspace root level: /home/runner/workspace/storage/apk
// This survives server rebuilds and is outside the artifact build directory
const APK_STORAGE_DIR = path.resolve(process.cwd(), "../../storage/apk");

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
