/**
 * API cari partner sparing (SM-06): GET /users/search.
 *
 * Fungsi menerima http client opsional agar mudah diuji (default: api).
 */
import { api } from './client';
import { SKILL_LABELS, SPORT_SUGGESTIONS, SkillLevel } from './profile';

export { SKILL_LABELS, SPORT_SUGGESTIONS };
export type { SkillLevel };

export interface PartnerItem {
  id: string;
  email: string;
  displayName: string | null;
  sports: string[];
  skillLevel: SkillLevel | null;
  lat: number | null;
  lng: number | null;
  avatarUrl: string | null;
  /** ST-07: badge terverifikasi (default false). */
  verified?: boolean;
  /** Meter dari titik query; hanya ada saat filter lat/lng dipakai. */
  distanceMeters?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SearchPartnersFilter {
  sport?: string;
  skill?: SkillLevel;
  lat?: number;
  lng?: number;
  /** Meter. Default server 10000 bila lat/lng diisi. */
  radius?: number;
  page?: number;
  limit?: number;
}

export interface SearchPartnersResult {
  data: PartnerItem[];
  meta: { page: number; limit: number; total: number };
}

/** Radius preset (meter) untuk picker cepat di UI. */
export const RADIUS_PRESETS = [1000, 5000, 10000, 25000, 50000];

interface Http {
  get<T>(url: string, config?: { params?: unknown }): Promise<{ data: T }>;
}

export async function searchPartners(
  filter: SearchPartnersFilter = {},
  http: Http = api,
): Promise<SearchPartnersResult> {
  const res = await http.get<SearchPartnersResult>('/users/search', { params: filter });
  return res.data;
}

/** Format jarak: <1000 m -> "850 m", selebihnya "1,1 km" (id-ID). */
export function formatDistance(meters?: number | null): string {
  if (meters == null || !Number.isFinite(meters)) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} km`;
}

/** Validasi sisi klien sebelum GET /users/search; pesan error atau null bila valid. */
export function validateSearchPartners(filter: SearchPartnersFilter): string | null {
  const latSet = filter.lat !== undefined;
  const lngSet = filter.lng !== undefined;
  if (latSet !== lngSet) return 'Lat dan Lng harus diisi berpasangan';
  if (latSet && (filter.lat == null || !Number.isFinite(filter.lat) || filter.lat < -90 || filter.lat > 90)) {
    return 'Lat harus angka -90 s/d 90';
  }
  if (lngSet && (filter.lng == null || !Number.isFinite(filter.lng) || filter.lng < -180 || filter.lng > 180)) {
    return 'Lng harus angka -180 s/d 180';
  }
  if (
    filter.radius !== undefined &&
    (!Number.isFinite(filter.radius) || filter.radius < 100 || filter.radius > 100000)
  ) {
    return 'Radius harus 100..100000 meter';
  }
  return null;
}
