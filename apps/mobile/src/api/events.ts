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

/** Ikut event (SM-05): POST /events/:id/join -> 201. Penuh/ganda -> 409. */
export async function joinEvent(id: string, http: Http = api): Promise<EventDetail> {
  const res = await http.post<EventDetail>(`/events/${id}/join`, {});
  return res.data;
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
  return null;
}
