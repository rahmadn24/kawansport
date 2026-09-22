/**
 * API venue + availability (BK-04): list/detail venue publik + slot per court.
 *
 * Fungsi menerima http client opsional agar mudah diuji (default: api).
 */
import { api } from './client';

export interface CourtItem {
  id: string;
  venueId: string;
  sport: string;
  name: string;
  pricePerHour: number;
  openHours: Record<string, unknown> | null;
  status: 'active' | 'inactive';
  createdAt?: string;
  updatedAt?: string;
}

export interface VenueItem {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  sports: string[];
  photos: string[];
  owner: { id: string; email: string; displayName: string | null };
  status: string;
  rejectionReason: string | null;
  courts: CourtItem[];
  distanceMeters?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ListVenuesFilter {
  sport?: string;
  lat?: number;
  lng?: number;
  radius?: number;
  page?: number;
  limit?: number;
}

export interface ListVenuesResult {
  data: VenueItem[];
  meta: { page: number; limit: number; total: number };
}

export type SlotStatus = 'free' | 'held' | 'booked';

export interface SlotItem {
  date: string;
  start: string;
  end: string;
  startMinute: number;
  endMinute: number;
  status: SlotStatus;
}

export interface AvailabilityResult {
  courtId: string;
  date: string;
  slots: SlotItem[];
}

interface Http {
  get<T>(url: string, config?: { params?: unknown }): Promise<{ data: T }>;
}

/** GET /venues — daftar venue approved (filter sport/geo + pagination). */
export async function listVenues(
  filter: ListVenuesFilter = {},
  http: Http = api,
): Promise<ListVenuesResult> {
  const res = await http.get<ListVenuesResult>('/venues', { params: filter });
  return res.data;
}

/** GET /venues/:id — detail venue + daftar court. */
export async function getVenueDetail(
  id: string,
  http: Http = api,
): Promise<VenueItem> {
  const res = await http.get<VenueItem>(`/venues/${id}`);
  return res.data;
}

/** GET /courts/:id/availability?date=YYYY-MM-DD — slot + status real-time. */
export async function getCourtAvailability(
  courtId: string,
  date: string,
  http: Http = api,
): Promise<AvailabilityResult> {
  const res = await http.get<AvailabilityResult>(
    `/courts/${courtId}/availability`,
    { params: { date } },
  );
  return res.data;
}

/** Court aktif saja (yang inactive tidak bisa dibooking → 409 di server). */
export function activeCourts(venue: Pick<VenueItem, 'courts'>): CourtItem[] {
  return (venue.courts ?? []).filter((c) => c.status === 'active');
}

/** Validasi sisi klien sebelum GET availability; pesan error atau null bila valid. */
export function validateAvailabilityDate(date: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Tanggal harus format YYYY-MM-DD';
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return 'Tanggal tidak valid';
  }
  return null;
}
