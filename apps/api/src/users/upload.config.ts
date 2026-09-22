import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import { extname, join } from 'path';

/**
 * Konfigurasi upload avatar (SM-03, MVP).
 *
 * MVP: file diterima sebagai buffer (memory storage bawaan Nest),
 * disimpan ke file lokal UPLOAD_DIR/avatars, lalu diserve statis
 * di prefix /uploads/. Alur "POST multipart -> simpan -> kembalikan URL"
 * ini kompatibel-S3 sehingga nanti bisa diganti MinIO/S3 hanya dengan
 * menukar saveAvatarBuffer() tanpa mengubah controller.
 */

const MAX_MB = Number(process.env.AVATAR_MAX_MB ?? 2);
export const AVATAR_MAX_BYTES = MAX_MB * 1024 * 1024;

export const AVATAR_MIME_ALLOWLIST = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

/** Struktur minimal file upload yang dipakai controller (hindari dep @types/multer). */
export interface UploadedAvatarFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** Direktori root upload (absolut). Dipakai controller + static serve di main.ts. */
export function getUploadDir(): string {
  const configured = process.env.UPLOAD_DIR;
  return configured ? join(process.cwd(), configured) : join(process.cwd(), 'uploads');
}

export function getAvatarDir(): string {
  return join(getUploadDir(), 'avatars');
}

export function ensureAvatarDir(): string {
  const dir = getAvatarDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function toAvatarUrl(filename: string): string {
  return `/uploads/avatars/${filename}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function avatarFileFilter(_req: any, file: any, cb: any) {
  if (!file || !AVATAR_MIME_ALLOWLIST.has(file.mimetype)) {
    cb(
      new BadRequestException(
        `Avatar must be an image (${[...AVATAR_MIME_ALLOWLIST].join(', ')})`,
      ),
      false,
    );
    return;
  }
  cb(null, true);
}

/** Simpan buffer avatar ke disk, kembalikan public URL. */
export async function saveAvatarBuffer(
  userId: string,
  file: UploadedAvatarFile,
): Promise<string> {
  if (!file?.buffer || file.size <= 0) {
    throw new BadRequestException('Avatar file is empty');
  }
  const dir = ensureAvatarDir();
  const ext = extname(file.originalname ?? '').toLowerCase() || '.png';
  const filename = `${userId}-${Date.now()}-${randomUUID()}${ext}`;
  await writeFile(join(dir, filename), file.buffer);
  return toAvatarUrl(filename);
}
