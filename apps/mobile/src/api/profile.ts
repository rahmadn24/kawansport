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
