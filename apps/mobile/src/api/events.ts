/**
 * API event (SM-04 + SM-05): CRUD/list/detail + join/leave/participants.
 *
 * Fungsi menerima http client opsional agar mudah diuji (default: api).
 */
import { api } from './client';
import { SPORT_SUGGESTIONS } from './profile';

export { SPORT_SUGGESTIONS };

export type EventStatus = 'open' | 'full';

export interface EventHost {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface SportEventItem {
  id: string;
  sport: string;
  title: string;
  description: string | null;
  datetime: string;
  lat: number;
  lng: number;
  capacity: number;
  participantsCount: number;
  status: EventStatus;
  /** ST-02: iuran per orang (rupiah, default 0 = gratis). Absen pada respons lama. */
  fee?: number;
  host: EventHost;
  distanceMeters?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateEventInput {
  sport: string;
  title: string;
  description?: string;
  /** ISO 8601, mis. 2026-10-03T09:00:00+07:00. */
  datetime: string;
  lat: number;
  lng: number;
  capacity: number;
  /** ST-02: iuran per orang rupiah (>= 0, default 0 = gratis). */
  fee?: number;
}

export interface ListEventsFilter {
  sport?: string;
  from?: string;
  to?: string;
  lat?: number;
  lng?: number;
  /** Meter. Default server 10000 bila lat/lng diisi. */
  radius?: number;
  page?: number;
  limit?: number;
}

export interface ListEventsResult {
  data: SportEventItem[];
  meta: { page: number; limit: number; total: number };
}

export interface EventDetail extends SportEventItem {
  isJoined: boolean;
  /**
   * Info booking event (BK-04): `booking` = paling relevan
   * (pending/paid terbaru, else terbaru) atau null bila belum ada;
   * `bookings` = semua booking event ini. Absen pada respons lama.
   */
  booking?: EventBookingInfo | null;
  bookings?: EventBookingInfo[];
}

/** Ringkas booking untuk konteks event (court, slot, status + Snap info). */
export interface EventBookingInfo {
  id: string;
  courtId: string;
  date: string;
  start: string;
  end: string;
  status: 'pending' | 'paid' | 'expired' | 'cancelled';
  amount: number;
  snapToken: string | null;
  redirectUrl: string | null;
  eventId: string | null;
}

export interface EventParticipantItem {
  userId: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  joinedAt: string;
}

export interface ParticipantsResult {
  data: EventParticipantItem[];
  meta: { total: number };
}

interface Http {
  get<T>(url: string, config?: { params?: unknown }): Promise<{ data: T }>;
  post<T>(url: string, body: unknown): Promise<{ data: T }>;
  delete<T>(url: string): Promise<{ data: T }>;
}

export async function createEvent(
  input: CreateEventInput,
  http: Http = api,
): Promise<SportEventItem> {
  const res = await http.post<SportEventItem>('/events', input);
  return res.data;
}

export async function listEvents(
  filter: ListEventsFilter = {},
  http: Http = api,
): Promise<ListEventsResult> {
  const res = await http.get<ListEventsResult>('/events', { params: filter });
  return res.data;
}

export async function getEventDetail(
  id: string,
  http: Http = api,
): Promise<EventDetail> {
  const res = await http.get<EventDetail>(`/events/${id}`);
  return res.data;
}

/** ST-02: info pembayaran join event berbayar (payment prefix EV-). */
export interface EventPaymentInfo {
  id: string;
  amount: number;
  status: 'pending' | 'paid' | 'cancelled' | 'expired';
  paymentRef: string;
  snapToken: string | null;
  redirectUrl: string | null;
}

/**
 * Hasil join event (SM-05 + ST-02/ST-03): server mengembalikan 3 bentuk —
 * gratis (`event.isJoined` true), berbayar (`payment` pending + `isJoined`
 * false), penuh (HTTP 409 `{ waitlisted: true, position }`, otomatis antre).
 * Bentuk 409 ditangkap di sini agar pemanggil cukup cek `waitlisted`.
 */
export interface JoinEventResult {
  /** Detail event terbaru; null bila join 409 dan refresh detail gagal. */
  event: EventDetail | null;
  /** Terisi (pending) hanya untuk event berbayar. */
  payment?: EventPaymentInfo | null;
  /** True bila event penuh dan user masuk antrean (ST-03). */
  waitlisted?: boolean;
  /** Posisi antrean 1-based (ST-03). */
  position?: number;
}

/**
 * Ikut event (SM-05 + ST-02/ST-03): POST /events/:id/join -> 201.
 * - Gratis: `{ event (isJoined true) }`.
 * - Berbayar (fee>0): `{ event (isJoined false), payment (pending) }`;
 *   join ulang saat pending aktif idempotent (paymentRef sama).
 * - Penuh: 409 `{ waitlisted: true, position }` -> dikembalikan sebagai
 *   `{ event (refresh), waitlisted: true, position }`, BUKAN throw.
 * - 409 lain (sudah join) tetap throw agar UI menampilkan error jujur.
 */
export async function joinEvent(id: string, http: Http = api): Promise<JoinEventResult> {
  try {
    const res = await http.post<
      EventDetail & { payment?: EventPaymentInfo | null } & {
        event?: EventDetail;
      }
    >(`/events/${id}/join`, {});
    const raw = res.data;
    if (raw && typeof raw.event === 'object' && raw.event !== null) {
      const nested = raw as { event: EventDetail; payment?: EventPaymentInfo | null };
      return { event: nested.event, payment: nested.payment ?? null };
    }
    const { payment, ...event } = raw as EventDetail & {
      payment?: EventPaymentInfo | null;
    };
    return { event: event as EventDetail, payment: payment ?? null };
  } catch (e) {
    const status = (e as { response?: { status?: number } })?.response?.status;
    const body = (e as { response?: { data?: unknown } })?.response?.data as
      | { waitlisted?: boolean; position?: number }
      | undefined;
    if (status === 409 && body?.waitlisted === true) {
      let event: EventDetail | null = null;
      try {
        event = await getEventDetail(id, http);
      } catch {
        event = null;
      }
      return { event, waitlisted: true, position: body.position };
    }
    throw e;
  }
}

/** Keluar event (SM-05): POST /events/:id/leave -> 200. Bukan peserta -> 404. */
export async function leaveEvent(id: string, http: Http = api): Promise<EventDetail> {
  const res = await http.post<EventDetail>(`/events/${id}/leave`, {});
  return res.data;
}

/** Daftar peserta event (SM-05), urut waktu join. */
export async function listParticipants(
  id: string,
  http: Http = api,
): Promise<ParticipantsResult> {
  const res = await http.get<ParticipantsResult>(`/events/${id}/participants`);
  return res.data;
}

/** Slot tersisa = capacity - participantsCount (min 0). */
export function slotsLeft(event: Pick<SportEventItem, 'capacity' | 'participantsCount'>): number {
  return Math.max(0, event.capacity - event.participantsCount);
}

/** Label iuran event (ST-02): 0/undefined -> "Gratis". */
export function formatEventFee(fee?: number | null): string {
  if (!fee || fee <= 0) return 'Gratis';
  return `Rp${Math.round(fee).toLocaleString('id-ID')}/orang`;
}

/** Satu baris antrean waiting list event (ST-03). */
export interface WaitlistItem {
  userId: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  /** Posisi 1-based, tidak di-reorder. */
  position: number;
  status: 'waiting' | 'invited';
  createdAt: string;
}

/** GET /events/:id/waitlist/me — posisi antreanku. 404 bila tak masuk antrean. */
export async function getMyWaitlist(id: string, http: Http = api): Promise<WaitlistItem> {
  const res = await http.get<WaitlistItem>(`/events/${id}/waitlist/me`);
  return res.data;
}

/** DELETE /events/:id/waitlist/me — keluar dari antrean. */
export async function leaveWaitlist(
  id: string,
  http: Http = api,
): Promise<{ ok: boolean; eventId: string }> {
  const res = await http.delete<{ ok: boolean; eventId: string }>(
    `/events/${id}/waitlist/me`,
  );
  return res.data;
}

/** GET /events/:id/waitlist — antrean penuh (hanya host/super_admin, else 403). */
export async function listWaitlist(
  id: string,
  http: Http = api,
): Promise<{ data: WaitlistItem[]; meta: { total: number } }> {
  const res = await http.get<{ data: WaitlistItem[]; meta: { total: number } }>(
    `/events/${id}/waitlist`,
  );
  return res.data;
}

/** Validasi sisi klien sebelum POST /events; kembalikan pesan error atau null bila valid. */
export function validateCreateEvent(input: CreateEventInput): string | null {
  if (!input.sport.trim()) return 'Olahraga wajib diisi';
  if (!input.title.trim()) return 'Judul wajib diisi';
  if (Number.isNaN(Date.parse(input.datetime))) return 'Waktu event tidak valid';
  if (!Number.isFinite(input.lat) || input.lat < -90 || input.lat > 90) {
    return 'Lat harus angka -90 s/d 90';
  }
  if (!Number.isFinite(input.lng) || input.lng < -180 || input.lng > 180) {
    return 'Lng harus angka -180 s/d 180';
  }
  if (!Number.isInteger(input.capacity) || input.capacity < 2 || input.capacity > 500) {
    return 'Kapasitas harus bilangan bulat 2..500';
  }
  if (
    input.fee !== undefined &&
    (!Number.isInteger(input.fee) || input.fee < 0)
  ) {
    return 'Iuran harus bilangan bulat >= 0';
  }
  return null;
}
