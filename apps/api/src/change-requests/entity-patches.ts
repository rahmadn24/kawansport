import { normalizeSports } from '../users/users.service';

/**
 * Builder patch ternormalisasi + daftar field sensitif (AD-02).
 * Modul murni (tanpa dependensi Nest/service) agar bisa dipakai dua arah:
 * service venues/products (path edit langsung) dan ChangeRequestsService
 * (apply saat admin approve) — hasilnya identik, tanpa circular import.
 */

/**
 * Field venue yang butuh approve saat entity sudah `approved`.
 * ST-01: foto venue dikelola langsung owner/admin TANPA change request
 * (endpoint POST/DELETE /venues/:id/photos + PATCH photos langsungimpan);
 * venue tetap harus `approved` agar tampil publik.
 */
export const VENUE_SENSITIVE_FIELDS = ['name'] as const;

/** Field court yang butuh approve saat venue induk sudah `approved`. */
export const COURT_SENSITIVE_FIELDS = [
  'name',
  'pricePerHour',
  'openHours',
] as const;

/** Field produk yang butuh approve saat produk sudah `approved`. */
export const PRODUCT_SENSITIVE_FIELDS = [
  'name',
  'price',
  'photos',
  'description',
] as const;

export function hasSensitiveKeys(
  dto: Record<string, unknown>,
  sensitive: readonly string[],
): boolean {
  return sensitive.some((k) => dto[k] !== undefined);
}

/** Trim, buang kosong, dedupe persis — mirror `normalizePhotos` venues. */
export function normalizePhotoList(input: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    const s = String(raw ?? '').trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

export interface VenuePatch {
  name?: string;
  address?: string;
  lat?: number;
  lng?: number;
  sports?: string[];
  photos?: string[];
}

/** Normalisasi patch venue dari DTO edit langsung maupun payload CR. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildVenuePayload(dto: Record<string, any>): VenuePatch {
  const patch: VenuePatch = {};
  if (dto.name !== undefined) patch.name = String(dto.name).trim();
  if (dto.address !== undefined) patch.address = String(dto.address).trim();
  if (dto.lat !== undefined) patch.lat = Number(dto.lat);
  if (dto.lng !== undefined) patch.lng = Number(dto.lng);
  if (dto.sports !== undefined) {
    patch.sports = normalizeSports(dto.sports as string[]);
  }
  if (dto.photos !== undefined) {
    patch.photos = normalizePhotoList(dto.photos as unknown[]);
  }
  return patch;
}

export interface CourtPatch {
  sport?: string;
  name?: string;
  pricePerHour?: number;
  openHours?: Record<string, unknown> | null;
  status?: 'active' | 'inactive';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildCourtPayload(dto: Record<string, any>): CourtPatch {
  const patch: CourtPatch = {};
  if (dto.sport !== undefined) patch.sport = String(dto.sport).trim();
  if (dto.name !== undefined) patch.name = String(dto.name).trim();
  if (dto.pricePerHour !== undefined) {
    patch.pricePerHour = Number(dto.pricePerHour);
  }
  if (dto.openHours !== undefined) {
    patch.openHours = (dto.openHours ?? null) as Record<string, unknown> | null;
  }
  if (dto.status !== undefined) patch.status = dto.status;
  return patch;
}

export interface ProductPatch {
  category?: string;
  name?: string;
  description?: string | null;
  price?: number;
  stock?: number;
  photos?: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildProductPayload(dto: Record<string, any>): ProductPatch {
  const patch: ProductPatch = {};
  if (dto.category !== undefined) {
    patch.category = String(dto.category).trim();
  }
  if (dto.name !== undefined) patch.name = String(dto.name).trim();
  if (dto.description !== undefined) {
    const s = String(dto.description ?? '').trim();
    patch.description = s ? s : null;
  }
  if (dto.price !== undefined) patch.price = Number(dto.price);
  if (dto.stock !== undefined) patch.stock = Number(dto.stock);
  if (dto.photos !== undefined) {
    patch.photos = normalizePhotoList(dto.photos as unknown[]);
  }
  return patch;
}
