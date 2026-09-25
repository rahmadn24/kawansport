/**
 * API pencarian gabungan ST-09: GET /search (publik, tanpa auth khusus —
 * sama seperti list venue/produk yang publik).
 *
 * Fungsi menerima http client opsional agar mudah diuji (default: api).
 */
import { api } from './client';

export type SearchKind = 'venue' | 'event' | 'product';

export interface SearchItem {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle: string | null;
  /** Meter dari titik query; hanya ada saat filter lat/lng dipakai. */
  distanceMeters?: number;
}

export interface SearchFilter {
  q?: string;
  lat?: number;
  lng?: number;
  /** Meter. Default server 10000 bila lat/lng diisi. */
  radius?: number;
  limit?: number;
}

export interface SearchResult {
  data: SearchItem[];
  meta: { total: number; limit: number };
}

interface Http {
  get<T>(url: string, config?: { params?: unknown }): Promise<{ data: T }>;
}

/** GET /search — hasil gabungan venue + event + produk. */
export async function searchAll(
  filter: SearchFilter = {},
  http: Http = api,
): Promise<SearchResult> {
  const res = await http.get<SearchResult>('/search', { params: filter });
  return res.data;
}

/**
 * Validasi sisi klien sebelum GET /search; pesan error atau null bila valid.
 * `q` boleh kosong (tanpa q = semua, dibatasi limit server).
 */
export function validateSearchFilter(filter: SearchFilter): string | null {
  const latSet = filter.lat !== undefined;
  const lngSet = filter.lng !== undefined;
  if (latSet !== lngSet) return 'Lat dan lng harus diisi berpasangan';
  if (latSet && (!Number.isFinite(filter.lat as number) || (filter.lat as number) < -90 || (filter.lat as number) > 90)) {
    return 'Lat harus angka -90 s/d 90';
  }
  if (lngSet && (!Number.isFinite(filter.lng as number) || (filter.lng as number) < -180 || (filter.lng as number) > 180)) {
    return 'Lng harus angka -180 s/d 180';
  }
  if (
    filter.radius !== undefined &&
    (!Number.isFinite(filter.radius) || filter.radius < 100 || filter.radius > 100000)
  ) {
    return 'Radius harus 100..100000 meter';
  }
  if (
    filter.limit !== undefined &&
    (!Number.isInteger(filter.limit) || filter.limit < 1 || filter.limit > 50)
  ) {
    return 'Limit harus bilangan bulat 1..50';
  }
  return null;
}

/** Label Bahasa Indonesia untuk kind hasil pencarian. */
export function searchKindLabel(kind: SearchKind): string {
  switch (kind) {
    case 'venue':
      return 'Venue';
    case 'event':
      return 'Event';
    case 'product':
      return 'Produk';
    default:
      return kind;
  }
}

/** Ikon presentasi per kind (bukan data server). */
export function searchKindIcon(kind: SearchKind): string {
  switch (kind) {
    case 'venue':
      return '🏟';
    case 'event':
      return '📅';
    case 'product':
      return '🛍';
    default:
      return '🔍';
  }
}
