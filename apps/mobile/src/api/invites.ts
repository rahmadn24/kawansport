/**
 * API invite sparing (GAP-01): POST /invites + GET /invites/me[?dir] + accept/decline.
 *
 * Sumber kebenaran shape: apps/api/ENDPOINTS.md seksi GAP-01.
 * Fungsi menerima http client opsional agar mudah diuji (default: api).
 */
import { api } from './client';
import type { ConversationItem } from './chat';

export type InviteStatus = 'pending' | 'accepted' | 'declined' | 'expired';

/** Arah daftar: 'in' = masuk (untukku), 'sent' = keluar (dariku). */
export type InviteDir = 'in' | 'sent';

export interface InviteItem {
  id: string;
  fromUserId: string;
  toUserId: string;
  sport: string | null;
  message: string | null;
  status: InviteStatus;
  eventId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SendInviteInput {
  toUserId: string;
  sport?: string;
  message?: string;
  eventId?: string;
}

export interface AcceptInviteResult extends InviteItem {
  conversation: ConversationItem;
}

interface Http {
  get<T>(url: string, config?: { params?: unknown }): Promise<{ data: T }>;
  post<T>(url: string, body: unknown): Promise<{ data: T }>;
}

/** Validasi input invite sisi klien; pesan error atau null bila valid. */
export function validateInviteInput(input: SendInviteInput): string | null {
  if (!input.toUserId || !input.toUserId.trim()) return 'Tujuan undangan wajib diisi';
  if (input.sport != null && input.sport.length > 60) return 'Cabang olahraga maksimal 60 karakter';
  if (input.message != null && input.message.length > 500) return 'Pesan undangan maksimal 500 karakter';
  return null;
}

/** POST /invites — kirim undangan sparing (201 InviteItem status pending). */
export async function sendInvite(
  input: SendInviteInput,
  http: Http = api,
): Promise<InviteItem> {
  const invalid = validateInviteInput(input);
  if (invalid) throw new Error(invalid);
  const res = await http.post<InviteItem>('/invites', input);
  return res.data;
}

/** GET /invites/me[?dir=sent] — default masuk; dir 'sent' = keluar. */
export async function listMyInvites(
  dir: InviteDir = 'in',
  http: Http = api,
): Promise<InviteItem[]> {
  const res = await http.get<{ data: InviteItem[] }>(
    '/invites/me',
    dir === 'sent' ? { params: { dir: 'sent' } } : undefined,
  );
  return res.data.data;
}

/** POST /invites/:id/accept — hanya penerima; ikut membuat conversation. */
export async function acceptInvite(
  id: string,
  http: Http = api,
): Promise<AcceptInviteResult> {
  const res = await http.post<AcceptInviteResult>(`/invites/${id}/accept`, {});
  return res.data;
}

/** POST /invites/:id/decline — hanya penerima. */
export async function declineInvite(
  id: string,
  http: Http = api,
): Promise<InviteItem> {
  const res = await http.post<InviteItem>(`/invites/${id}/decline`, {});
  return res.data;
}

/** Label status invite bahasa manusia untuk badge. */
export function inviteStatusLabel(status: InviteStatus): string {
  if (status === 'pending') return 'Menunggu';
  if (status === 'accepted') return 'Diterima';
  if (status === 'declined') return 'Ditolak';
  return 'Kedaluwarsa';
}
