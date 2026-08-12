import 'server-only';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { decryptBuffer, encryptBuffer, randomToken } from './crypto';

// I file documento sono cifrati a riposo (AES-256-GCM) sul filesystem.
// In produzione l'adapter è sostituibile con object storage (S3/compatibile) via ProviderConfig kind=STORAGE.

function baseDir(): string {
  return path.resolve(process.env.STORAGE_DIR || './storage');
}

export const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'];
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export async function saveEncrypted(buf: Buffer, ext: string): Promise<string> {
  const dir = baseDir();
  await mkdir(dir, { recursive: true });
  const name = `${randomToken(16)}${ext}`;
  await writeFile(path.join(dir, name), encryptBuffer(buf));
  return name;
}

export async function readDecrypted(fileName: string): Promise<Buffer> {
  // path traversal guard
  const safe = path.basename(fileName);
  const buf = await readFile(path.join(baseDir(), safe));
  return decryptBuffer(buf);
}

// Controllo dei magic bytes: il mime dichiarato dal client non è affidabile
export function sniffMime(buf: Buffer): string | null {
  if (buf.subarray(0, 5).toString() === '%PDF-') return 'application/pdf';
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf[0] === 0x89 && buf.subarray(1, 4).toString() === 'PNG') return 'image/png';
  if (buf.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}
