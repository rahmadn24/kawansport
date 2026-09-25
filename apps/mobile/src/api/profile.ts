/**
 * API profil user (SM-03): GET /me, PATCH /me, POST /me/avatar.
 *
 * Fungsi menerima http client opsional agar mudah diuji (default: api).
 */
import { api } from './client';

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';

export const SKILL_LEVELS: SkillLevel[] = ['beginner', 'intermediate', 'advanced'];

export const SKILL_LABELS: Record<SkillLevel, string> = {
  beginner: 'Pemula',
  intermediate: 'Menengah',
  advanced: 'Lanjutan',
};

export const SPORT_SUGGESTIONS = [
  'Futsal',
  'Sepak Bola',
  'Basket',
  'Voli',
  'Badminton',
  'Tenis',
  'Tenis Meja',
  'Lari',
  'Sepeda',
  'Renang',
  'Yoga',
  'Gym',
];

export interface UserProfile {
  id: string;
  email: string;
  displayName: string | null;
  sports: string[];
  skillLevel: SkillLevel | null;
  lat: number | null;
  lng: number | null;
  avatarUrl: string | null;
  /** AD-01: role user (super_admin | venue_owner | seller | user). */
  role?: string;
  /** ST-04: saldo Poin Kawan (1 poin = Rp1 saat redeem; +50 per review). */
  loyaltyPoints?: number;
  /** ST-07: badge terverifikasi (default false; via POST /users/:id/verify admin). */
  verified?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateProfileInput {
  displayName?: string;
  sports?: string[];
  skillLevel?: SkillLevel | null;
  /** Kirim keduanya untuk set lokasi, keduanya null untuk hapus. */
  lat?: number | null;
  lng?: number | null;
}

interface Http {
  get<T>(url: string): Promise<{ data: T }>;
  patch<T>(url: string, body: unknown): Promise<{ data: T }>;
  post<T>(url: string, body: unknown, config?: unknown): Promise<{ data: T }>;
  delete<T>(url: string): Promise<{ data: T }>;
}

/** Toggle satu olahraga di daftar pilihan (murni, untuk multi-select UI). */
export function toggleSport(selected: string[], sport: string): string[] {
  const name = sport.trim();
  if (!name) return selected;
  const exists = selected.some((s) => s.toLowerCase() === name.toLowerCase());
  if (exists) return selected.filter((s) => s.toLowerCase() !== name.toLowerCase());
  return [...selected, name];
}

export async function fetchMe(http: Http = api): Promise<UserProfile> {
  const res = await http.get<UserProfile>('/me');
  return res.data;
}

export async function updateMe(
  input: UpdateProfileInput,
  http: Http = api,
): Promise<UserProfile> {
  const res = await http.patch<UserProfile>('/me', input);
  return res.data;
}

export interface AvatarRef {
  uri: string;
  name?: string;
  type?: string;
}

/** Upload avatar sebagai multipart/form-data, kembalikan public URL. */
export async function uploadAvatar(
  file: AvatarRef,
  http: Http = api,
): Promise<string> {
  const form = new FormData();
  form.append('avatar', {
    uri: file.uri,
    name: file.name ?? 'avatar.jpg',
    type: file.type ?? 'image/jpeg',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  const res = await http.post<{ avatarUrl: string }>('/me/avatar', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.avatarUrl;
}

/**
 * DELETE /me — hapus akun sendiri (GAP-02).
 * 200 `{ ok: true }` + SEMUA sesi ikut logout (refresh token hangus).
 * 409 bila ada tanggungan (booking/order aktif, event mendatang, venue,
 * profil seller) — pesan server memuat alasan; JANGAN ditelan, tampilkan.
 */
export async function deleteMyAccount(
  http: Http = api,
): Promise<{ ok: boolean }> {
  const res = await http.delete<{ ok: boolean }>('/me');
  return res.data;
}

/* ---------- ST-07 TERBATAS: statistik + circle ---------- */

/**
 * Statistik profil (ST-07) — cermin UserStats API: angka dari data REAL
 * (host/join event, booking paid, gabungan cabor). SENGAJA TANPA win-rate
 * (butuh EL-00, riwayat match) — TODO-EL-00.
 */
export interface UserStats {
  user: {
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
    verified: boolean;
  };
  totalEventsHosted: number;
  totalEventsJoined: number;
  totalBookingsPaid: number;
  sportsCount: number;
  sports: string[];
}

/**
 * Anggota lingkaran mabar (ST-07) — cermin CircleMember API: partner chat
 * + co-participants event, dedupe, maks 50.
 * Tombol "Ajak Mabar" memakai ulang sendInvite (POST /invites, GAP-01).
 */
export interface CircleMember {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  verified: boolean;
  sports: string[];
  skillLevel: SkillLevel | null;
}

/** GET /users/:id/stats — boleh dibaca user login apa pun. */
export async function fetchUserStats(
  userId: string,
  http: Http = api,
): Promise<UserStats> {
  const res = await http.get<UserStats>(`/users/${userId}/stats`);
  return res.data;
}

/** GET /users/me/circle — lingkaran mabar milik sendiri. */
export async function fetchMyCircle(http: Http = api): Promise<CircleMember[]> {
  const res = await http.get<{ data: CircleMember[] }>('/users/me/circle');
  return res.data.data;
}

/**
 * Ringkasan statistik 1 baris untuk seksi profil,
 * mis. "3 Event • 5 Ikut Mabar • 2 Booking • 4 Cabor".
 */
export function formatStatsSummary(stats: UserStats): string {
  return (
    `${stats.totalEventsHosted} Event • ` +
    `${stats.totalEventsJoined} Ikut Mabar • ` +
    `${stats.totalBookingsPaid} Booking • ` +
    `${stats.sportsCount} Cabor`
  );
}

/** Label badge verifikasi untuk profil/partner, atau null bila belum verified. */
export function verifiedLabel(verified?: boolean | null): string | null {
  return verified ? '✓ Terverifikasi' : null;
}
