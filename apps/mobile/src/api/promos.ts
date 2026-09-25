/**
 * API banner promo CMS-managed ST-09: GET /promos (publik).
 *
 * Kontrak jujur: daftar kosong = banner DISEMBUNYIKAN (bukan placeholder
 * palsu). CRUD (POST/PATCH/DELETE) hanya ada di API + CMS admin.
 *
 * Fungsi menerima http client opsional agar mudah diuji (default: api).
 */
import { api } from './client';

export interface PromoItem {
  id: string;
  title: string;
  imageUrl: string;
  link: string | null;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ListPromosResult {
  data: PromoItem[];
  meta: { total: number };
}

interface Http {
  get<T>(url: string, config?: { params?: unknown }): Promise<{ data: T }>;
}

/** GET /promos — hanya banner aktif dalam periode (difilter server). */
export async function listPromos(http: Http = api): Promise<PromoItem[]> {
  const res = await http.get<ListPromosResult>('/promos');
  return res.data.data;
}

/**
 * True bila banner layak tampil (fail-soft: daftar kosong/null =
 * sembunyikan, BUKAN placeholder palsu).
 */
export function hasLivePromos(
  promos: readonly PromoItem[] | null | undefined,
): boolean {
  return !!promos && promos.length > 0;
}
