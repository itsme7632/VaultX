import { promises as fs } from "fs";
import path from "path";
import { createReadStream } from "fs";
import type { ReadStream } from "fs";

function resolveStorageDir(): string {
  const envDir = process.env.PRIVATE_OBJECT_DIR;
  if (envDir) {
    const clean = envDir.replace(/\/$/, "");
    return path.isAbsolute(clean) ? clean : path.resolve(clean);
  }

  if (process.env.REPL_ID || process.env.REPLIT_DB_URL) {
    return "/uploads/apk";
  }

  return path.resolve("./storage/private/apk");
}

export async function ensureApkStorageDir(): Promise<string> {
  const dir = resolveStorageDir();
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function saveApkFile(buffer: Buffer, fileId: string): Promise<string> {
  let dir: string;
  try {
    dir = await ensureApkStorageDir();
  } catch {
    dir = path.resolve("./storage/private/apk");
    await fs.mkdir(dir, { recursive: true });
  }

  const filePath = path.join(dir, fileId);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

export async function apkFileExists(fileId: string): Promise<boolean> {
  try {
    const dir = await ensureApkStorageDir();
    await fs.access(path.join(dir, fileId));
    return true;
  } catch {
    const fallback = path.resolve("./storage/private/apk");
    try {
      await fs.access(path.join(fallback, fileId));
      return true;
    } catch {
      return false;
    }
  }
}

export async function getApkReadStream(fileId: string): Promise<ReadStream> {
  const dir = await ensureApkStorageDir();
  const primary = path.join(dir, fileId);
  try {
    await fs.access(primary);
    return createReadStream(primary);
  } catch {
    const fallback = path.join(path.resolve("./storage/private/apk"), fileId);
    await fs.access(fallback);
    return createReadStream(fallback);
  }
}

export async function deleteApkFile(fileId: string): Promise<void> {
  const candidates: string[] = [];

  try {
    const dir = await ensureApkStorageDir();
    candidates.push(path.join(dir, fileId));
  } catch {}

  const fallback = path.join(path.resolve("./storage/private/apk"), fileId);
  if (!candidates.includes(fallback)) candidates.push(fallback);

  for (const p of candidates) {
    try { await fs.unlink(p); } catch {}
  }
}

export function getApkStorageInfo(): { mode: string; dir: string } {
  const envDir = process.env.PRIVATE_OBJECT_DIR;
  if (envDir) {
    return { mode: "env", dir: envDir };
  }
  if (process.env.REPL_ID || process.env.REPLIT_DB_URL) {
    return { mode: "replit", dir: "/uploads/apk" };
  }
  return { mode: "local", dir: "./storage/private/apk" };
}
