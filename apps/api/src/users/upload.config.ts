import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as FileType from 'file-type';
import { existsSync, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import { join } from 'path';

/**
 * Konfigurasi upload image (SM-03 avatar + ST-01 generik, MVP).
 *
 * MVP: file diterima sebagai buffer (memory storage bawaan Nest),
 * disimpan ke file lokal UPLOAD_DIR/<subdir>, lalu diserve statis
 * di prefix /uploads/. Alur "POST multipart -> simpan -> kembalikan URL"
 * ini kompatibel-S3 sehingga nanti bisa diganti MinIO/S3 hanya dengan
 * menukar saveImageBuffer() tanpa mengubah controller.
 */

const AVATAR_MAX_MB = Number(process.env.AVATAR_MAX_MB ?? 2);
export const AVATAR_MAX_BYTES = AVATAR_MAX_MB * 1024 * 1024;

/** Batas upload generik ST-01 (default 5MB, via UPLOAD_MAX_MB). */
const GENERIC_MAX_MB = Number(process.env.UPLOAD_MAX_MB ?? 5);
export const GENERIC_UPLOAD_MAX_BYTES = GENERIC_MAX_MB * 1024 * 1024;

export const AVATAR_MIME_ALLOWLIST = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

/** Allowlist generik ST-01 — sama dengan avatar (tolak svg). */
export const IMAGE_MIME_ALLOWLIST = AVATAR_MIME_ALLOWLIST;

/** Struktur minimal file upload yang dipakai controller (hindari dep @types/multer). */
export interface UploadedAvatarFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** Alias generik ST-01 — bentuknya identik dengan file avatar. */
export type UploadedImageFile = UploadedAvatarFile;

/** Subdirektori upload yang dikenal (avatars = SM-03, images = ST-01). */
export type UploadSubdir = 'avatars' | 'images';

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

/** Direktori upload generik ST-01 (UPLOAD_DIR/images). */
export function getImagesDir(): string {
  return join(getUploadDir(), 'images');
}

export function ensureImagesDir(): string {
  const dir = getImagesDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function toImageUrl(filename: string): string {
  return `/uploads/images/${filename}`;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function imageFileFilter(_req: any, file: any, cb: any) {
  if (!file || !IMAGE_MIME_ALLOWLIST.has(file.mimetype)) {
    cb(
      new BadRequestException(
        `File must be an image (${[...IMAGE_MIME_ALLOWLIST].join(', ')})`,
      ),
      false,
    );
    return;
  }
  cb(null, true);
}

/**
 * Simpan buffer image ke disk di subdir upload, kembalikan public URL.
 * Validasi magic bytes via file-type (jangan percaya mimetype klien);
 * SVG ditolak (teks, tak terdeteksi = gagal). Ekstensi ditulis ulang
 * dari hasil deteksi, bukan dari nama file klien.
 */
export async function saveImageBuffer(
  subdir: UploadSubdir,
  prefix: string,
  file: UploadedImageFile,
  label = 'File',
): Promise<string> {
  if (!file?.buffer || file.size <= 0) {
    throw new BadRequestException(`${label} file is empty`);
  }
  // SEC-01 Medium: jangan percaya ekstensi/mimetype kiriman klien — deteksi
  // tipe via magic bytes (file-type v16, CJS agar kompatibel ts-jest).
  // SVG ditolak (teks, tak terdeteksi = gagal).
  const detected = await FileType.fromBuffer(file.buffer).catch(
    () => undefined,
  );
  if (!detected || !IMAGE_MIME_ALLOWLIST.has(detected.mime)) {
    throw new BadRequestException(
      `${label} must be an image (${[...IMAGE_MIME_ALLOWLIST].join(', ')})`,
    );
  }
  // Tulis ulang ekstensi dari hasil deteksi (bukan dari nama file klien).
  const ext = detected.ext === 'jpg' ? '.jpg' : `.${detected.ext}`;
  const dir =
    subdir === 'avatars' ? ensureAvatarDir() : ensureImagesDir();
  const filename = `${prefix}-${Date.now()}-${randomUUID()}${ext}`;
  await writeFile(join(dir, filename), file.buffer);
  return subdir === 'avatars' ? toAvatarUrl(filename) : toImageUrl(filename);
}

/** Simpan buffer avatar ke disk, kembalikan public URL. */
export async function saveAvatarBuffer(
  userId: string,
  file: UploadedAvatarFile,
): Promise<string> {
  return saveImageBuffer('avatars', userId, file, 'Avatar');
}
