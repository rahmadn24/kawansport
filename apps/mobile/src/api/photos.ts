/**
 * Helper foto ST-01 (display-only, mobile).
 *
 * Aturan URL aman = mirror backend `isAllowedPhotoUrl`
 * (apps/api/src/uploads/photo-url.ts):
 * - path hasil upload sendiri (`/uploads/...`), atau
 * - URL https eksternal (CDN).
 * Skema lain (http, data:, javascript:, path traversal `..`) DITOLAK
 * agar <Image> tak pernah memuat URL aneh.
 *
 * Upload baru (POST /uploads multipart) DISABLED jujur di mobile:
 * butuh file picker native yang TAK tersedia — JANGAN tambah dep native.
 */
// TODO(ST-01-upload): upload foto baru (POST /uploads multipart) butuh file
// picker native — sementara form hanya display + banner disabled jujur.
import { API_URL } from '../config';

/** True bila URL foto aman dimuat: path /uploads/... atau https. */
export function isAllowedPhotoUrl(url: unknown): boolean {
  if (typeof url !== 'string') return false;
  const s = url.trim();
  if (!s || s.length > 2048) return false;
  if (s.startsWith('/uploads/')) {
    if (s.includes('..') || s.includes('\\') || /\s/.test(s)) return false;
    return s.length > '/uploads/'.length;
  }
  try {
    return new URL(s).protocol === 'https:';
  } catch {
    return false;
  }
}

/** Buang entri tak aman/kosong; tak pernah throw; tak ubah urutan. */
export function sanitizePhotos(photos: readonly unknown[] | null | undefined): string[] {
  if (!Array.isArray(photos)) return [];
  const out: string[] = [];
  for (const p of photos) {
    if (typeof p === 'string' && isAllowedPhotoUrl(p)) out.push(p.trim());
  }
  return out;
}

/**
 * Ubah path relatif API (`/uploads/...`) menjadi URL absolut siap <Image>.
 * URL https dikembalikan apa adanya (trim). Input tak aman -> ''.
 */
export function resolvePhotoUrl(
  url: string,
  baseUrl: string = API_URL,
): string {
  const s = (url ?? '').trim();
  if (!isAllowedPhotoUrl(s)) return '';
  if (s.startsWith('/uploads/')) {
    const base = (baseUrl ?? '').replace(/\/+$/, '');
    return `${base}${s}`;
  }
  return s;
}

/** Foto pertama yang aman, atau null bila kosong. */
export function firstPhoto(
  photos: readonly unknown[] | null | undefined,
): string | null {
  const clean = sanitizePhotos(photos);
  return clean.length > 0 ? clean[0] : null;
}
