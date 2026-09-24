/**
 * API dispute center (API-W02): lapor + daftar milik sendiri.
 * Fungsi menerima http client opsional agar mudah diuji (default: api).
 */

import { api } from './client';

export type DisputeTargetType = 'booking' | 'order' | 'user' | 'venue';
export type DisputeCategory = 'no_show' | 'smurfing' | 'refund' | 'other';
export type DisputeStatus = 'open' | 'investigating' | 'resolved' | 'rejected';

export interface DisputeItem {
  id: string;
  reporterId: string;
  targetType: DisputeTargetType;
  targetId: string;
  category: DisputeCategory;
  description: string;
  status: DisputeStatus;
  resolution: string | null;
  resolvedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDisputeInput {
  targetType: DisputeTargetType;
  targetId: string;
  category: DisputeCategory;
  description: string;
}

interface Http {
  get<T>(url: string, config?: { params?: unknown }): Promise<{ data: T }>;
  post<T>(url: string, body: unknown): Promise<{ data: T }>;
}

/** POST /disputes — buat laporan (status awal `open`). */
export async function createDispute(
  input: CreateDisputeInput,
  http: Http = api,
): Promise<DisputeItem> {
  const res = await http.post<DisputeItem>('/disputes', input);
  return res.data;
}

/** GET /disputes/me — daftar laporan milik sendiri, terbaru dulu. */
export async function listMyDisputes(http: Http = api): Promise<DisputeItem[]> {
  const res = await http.get<{ data: DisputeItem[] }>('/disputes/me');
  return res.data.data;
}

/** Validasi sisi klien sebelum POST /disputes; pesan error atau null bila valid. */
export function validateCreateDispute(input: CreateDisputeInput): string | null {
  const targets: DisputeTargetType[] = ['booking', 'order', 'user', 'venue'];
  const categories: DisputeCategory[] = ['no_show', 'smurfing', 'refund', 'other'];
  if (!targets.includes(input.targetType)) return 'Jenis target tidak valid';
  if (!input.targetId.trim()) return 'Target laporan wajib diisi';
  if (!categories.includes(input.category)) return 'Kategori tidak valid';
  if (!input.description.trim()) return 'Deskripsi wajib diisi';
  if (input.description.length > 2000) return 'Deskripsi maksimal 2000 karakter';
  return null;
}

/** Label kategori dispute Bahasa Indonesia untuk UI. */
export function disputeCategoryLabel(category: DisputeCategory): string {
  switch (category) {
    case 'no_show':
      return 'Tidak hadir';
    case 'smurfing':
      return 'Smurfing';
    case 'refund':
      return 'Refund';
    case 'other':
      return 'Lainnya';
    default:
      return category;
  }
}

/** Label status dispute Bahasa Indonesia untuk UI. */
export function disputeStatusLabel(status: DisputeStatus): string {
  switch (status) {
    case 'open':
      return 'Terbuka';
    case 'investigating':
      return 'Ditelusuri';
    case 'resolved':
      return 'Selesai';
    case 'rejected':
      return 'Ditolak';
    default:
      return status;
  }
}
