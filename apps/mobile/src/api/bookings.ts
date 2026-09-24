/**
 * API booking lapangan (BK-03 + BK-04): booking langsung, booking dari event,
 * daftar milik sendiri, detail, cancel. Plus helper format untuk UI.
 *
 * Fungsi menerima http client opsional agar mudah diuji (default: api).
 */
import { api } from './client';

export type BookingStatus = 'pending' | 'paid' | 'expired' | 'cancelled';

export interface BookingItem {
  id: string;
  userId: string;
  courtId: string;
  date: string;
  start: string;
  end: string;
  startMinute: number;
  endMinute: number;
  status: BookingStatus;
  paymentRef: string;
  amount: number;
  snapToken: string | null;
  redirectUrl: string | null;
  /** Id event asal (BK-04); null bila booking langsung. */
  eventId: string | null;
  /** API-W07: kode check-in unik (KS-XXXXXX); null untuk baris pra-W07. */
  code: string | null;
  /** API-W06: kanal booking (walk-in dicatat owner, tanpa Midtrans). */
  channel: 'app' | 'walkin';
  /** API-W06: nama pembeli walk-in; null untuk channel app. */
  buyerName?: string | null;
  /** API-W07: waktu check-in; null bila belum check-in. */
  checkedInAt?: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** ST-04: snapshot akuntansi (subtotal → diskon voucher → poin → total). */
  subtotal?: number;
  discount?: number;
  voucherCode?: string | null;
  pointsUsed?: number;
  /** API-W03: snapshot service fee (0 bila fee off). */
  serviceFee?: number;
}

export interface CreateBookingInput {
  courtId: string;
  /** YYYY-MM-DD. */
  date: string;
  /** Salah satu dari start / startMinute wajib diisi. */
  start?: string;
  startMinute?: number;
  durationMinutes?: number;
  /** ST-04: kode voucher (uppercase) + poin dipakai (1 poin = Rp1). */
  voucherCode?: string;
  usePoints?: number;
}

export interface BookEventInput {
  courtId: string;
  /** YYYY-MM-DD, wajib hari yang sama dengan datetime event (aturan BK-04). */
  date: string;
  start?: string;
  startMinute?: number;
  durationMinutes?: number;
  /** ST-04: kode voucher (uppercase) + poin dipakai. */
  voucherCode?: string;
  usePoints?: number;
}

interface Http {
  get<T>(url: string, config?: { params?: unknown }): Promise<{ data: T }>;
  post<T>(url: string, body: unknown): Promise<{ data: T }>;
}

/** POST /bookings — booking langsung (pending + Snap token). */
export async function createBooking(
  input: CreateBookingInput,
  http: Http = api,
): Promise<BookingItem> {
  const res = await http.post<BookingItem>('/bookings', input);
  return res.data;
}

/** POST /events/:id/book — booking slot untuk event (host/peserta). */
export async function bookEventCourt(
  eventId: string,
  input: BookEventInput,
  http: Http = api,
): Promise<BookingItem> {
  const res = await http.post<BookingItem>(`/events/${eventId}/book`, input);
  return res.data;
}

/** GET /bookings/me — daftar booking milik sendiri. */
export async function listMyBookings(http: Http = api): Promise<BookingItem[]> {
  const res = await http.get<{ data: BookingItem[] }>('/bookings/me');
  return res.data.data;
}

/** GET /bookings/:id — detail booking milik sendiri. */
export async function getBookingDetail(
  id: string,
  http: Http = api,
): Promise<BookingItem> {
  const res = await http.get<BookingItem>(`/bookings/${id}`);
  return res.data;
}

/** POST /bookings/:id/cancel — batalkan booking pending milik sendiri. */
export async function cancelBooking(
  id: string,
  http: Http = api,
): Promise<{ ok: boolean; id: string; status: string }> {
  const res = await http.post<{ ok: boolean; id: string; status: string }>(
    `/bookings/${id}/cancel`,
    {},
  );
  return res.data;
}

/** GET /bookings/by-code/:code — lookup kasir (owner venue / super_admin, case-insensitive). */
export async function lookupBookingByCode(
  code: string,
  http: Http = api,
): Promise<BookingItem> {
  const res = await http.get<BookingItem>(`/bookings/by-code/${code.trim()}`);
  return res.data;
}

/** POST /bookings/:id/check-in — check-in sekali saja (owner venue / super_admin). */
export async function checkInBooking(
  id: string,
  http: Http = api,
): Promise<BookingItem> {
  const res = await http.post<BookingItem>(`/bookings/${id}/check-in`, {});
  return res.data;
}

/** Label status booking Bahasa Indonesia untuk UI. */
export function bookingStatusLabel(status: BookingStatus): string {
  switch (status) {
    case 'pending':
      return 'Menunggu bayar';
    case 'paid':
      return 'Lunas';
    case 'expired':
      return 'Kedaluwarsa';
    case 'cancelled':
      return 'Dibatalkan';
    default:
      return status;
  }
}

/** Format rupiah: 120000 -> "Rp120.000". */
export function formatIDR(amount: number): string {
  return `Rp${Math.round(amount).toLocaleString('id-ID')}`;
}

/** Label slot: date + jam, mis. "17 Jun 2030 • 09:00–10:00". */
export function formatSlotLabel(date: string, start: string, end: string): string {
  return `${formatDateShort(date)} • ${start}–${end}`;
}

/** YYYY-MM-DD -> "17 Jun 2030" (id-ID, tanpa lib tanggal). */
export function formatDateShort(date: string): string {
  const MONTHS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
  ];
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return date;
  return `${Number(m[3])} ${month} ${m[1]}`;
}

/** Date -> kunci YYYY-MM-DD (waktu lokal perangkat). */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

/**
 * ISO datetime event -> kunci YYYY-MM-DD hari-UTC.
 * Selaras aturan same-day server BK-04 (banding kalender UTC datetime event).
 */
export function eventDayKey(datetimeISO: string): string {
  return new Date(datetimeISO).toISOString().slice(0, 10);
}

/** Strip 14 hari ke depan mulai hari ini untuk date picker venue. */
export function next14Days(from: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    out.push(toDateKey(d));
  }
  return out;
}

/** Validasi sisi klien sebelum booking; pesan error atau null bila valid. */
export function validateBookingInput(input: CreateBookingInput | BookEventInput): string | null {
  if (!input.courtId) return 'Court wajib dipilih';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return 'Tanggal harus format YYYY-MM-DD';
  if (input.start === undefined && input.startMinute === undefined) {
    return 'Jam mulai wajib dipilih';
  }
  if (input.start !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.start)) {
    return 'Jam mulai tidak valid (HH:MM)';
  }
  return null;
}
