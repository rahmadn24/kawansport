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
  /** Fasilitas spesifik court (ST-10, chips di VenueDetail). */
  facilities?: string[];
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
  /** Fasilitas venue (ST-10, chips di VenueDetail). */
  facilities?: string[];
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

export type SlotStatus = 'free' | 'held' | 'booked' | 'blocked';

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

/** Item sewa venue (ST-10) — katalog upsell di slot picker. */
export interface RentalItem {
  id: string;
  venueId: string;
  name: string;
  price: number;
  stock: number;
  unit: string | null;
  status: 'active' | 'inactive';
  createdAt?: string;
  updatedAt?: string;
}

export interface ListRentalsResult {
  data: RentalItem[];
  meta: { total: number };
}

/** Pilihan sewa user di slot picker (diteruskan ke createBooking). */
export interface RentalSelection {
  rentalId: string;
  qty: number;
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

/** GET /venues/:id/rentals — katalog sewa (hanya item active untuk publik). */
export async function getVenueRentals(
  venueId: string,
  http: Http = api,
): Promise<RentalItem[]> {
  const res = await http.get<ListRentalsResult>(`/venues/${venueId}/rentals`);
  return res.data.data;
}

/** Total sewa = sum(price*qty) untuk pilihan user (display sticky total). */
export function rentalsTotal(
  catalog: Pick<RentalItem, 'id' | 'price'>[],
  selection: RentalSelection[],
): number {
  const priceById = new Map(catalog.map((r) => [r.id, r.price]));
  return selection.reduce(
    (sum, s) => sum + (priceById.get(s.rentalId) ?? 0) * s.qty,
    0,
  );
}

/**
 * Validasi pilihan sewa sisi klien; pesan error atau null bila valid.
 * Stok dicek ulang di server (sumber kebenaran); ini hanya cegah input absurd.
 */
export function validateRentalSelection(
  catalog: RentalItem[],
  selection: RentalSelection[],
): string | null {
  const byId = new Map(catalog.map((r) => [r.id, r]));
  for (const s of selection) {
    const item = byId.get(s.rentalId);
    if (!item) return 'Item sewa tidak dikenal';
    if (item.status !== 'active') return `${item.name} sedang tidak tersedia`;
    if (!Number.isInteger(s.qty) || s.qty < 1) {
      return `Jumlah ${item.name} minimal 1`;
    }
    if (s.qty > item.stock) {
      return `Stok ${item.name} tersisa ${item.stock}`;
    }
  }
  return null;
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

/**
 * Slot bisa dibooking hanya saat `free` (API-W06: `blocked` = ditutup owner
 * untuk maintenance — beda dari `booked` agar statistik okupansi jujur).
 */
export function isBookable(slot: Pick<SlotItem, 'status'>): boolean {
  return slot.status === 'free';
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
