/**
 * API payout & withdraw mitra (API-W08, manual catat-dan-approve).
 * Dipakai bila login sebagai venue_owner / seller di mobile.
 * Fungsi menerima http client opsional agar mudah diuji (default: api).
 */

import { api } from './client';

export type PayoutPayeeType = 'venue' | 'seller';
export type PayoutStatus = 'requested' | 'approved' | 'rejected' | 'paid';

export interface PayoutBalance {
  payeeType: PayoutPayeeType | null;
  payeeId: string | null;
  gross: number;
  commissionPercent: number;
  net: number;
  reserved: number;
  available: number;
  breakdown?: PayoutBalance[];
}

export interface PayoutItem {
  id: string;
  payeeType: PayoutPayeeType;
  payeeId: string;
  amount: number;
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
  status: PayoutStatus;
  reference: string | null;
  reason: string | null;
  requestedBy: string;
  handledBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RequestPayoutInput {
  payeeType: PayoutPayeeType;
  payeeId: string;
  amount: number;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
}

interface Http {
  get<T>(url: string, config?: { params?: unknown }): Promise<{ data: T }>;
  post<T>(url: string, body: unknown): Promise<{ data: T }>;
}

/**
 * GET /payouts/balance — saldo live (net − reserved yang approved/paid).
 * Tanpa argumen = agregat semua payee milik sendiri.
 */
export async function getPayoutBalance(
  query?: { payeeType: PayoutPayeeType; payeeId: string },
  http: Http = api,
): Promise<PayoutBalance> {
  const res = await http.get<PayoutBalance>('/payouts/balance', {
    params: query ?? {},
  });
  return res.data;
}

/** POST /payouts — ajukan withdraw (`amount` ≤ available, else 409). */
export async function requestPayout(
  input: RequestPayoutInput,
  http: Http = api,
): Promise<PayoutItem> {
  const res = await http.post<PayoutItem>('/payouts', input);
  return res.data;
}

/** GET /payouts/me — riwayat payout milik sendiri, terbaru dulu. */
export async function listMyPayouts(http: Http = api): Promise<PayoutItem[]> {
  const res = await http.get<{ data: PayoutItem[] }>('/payouts/me');
  return res.data.data;
}

/** Validasi sisi klien sebelum POST /payouts; pesan error atau null bila valid. */
export function validateRequestPayout(input: RequestPayoutInput): string | null {
  if (input.payeeType !== 'venue' && input.payeeType !== 'seller') {
    return 'Jenis penerima tidak valid';
  }
  if (!input.payeeId.trim()) return 'Penerima wajib dipilih';
  if (!Number.isInteger(input.amount) || input.amount < 1) {
    return 'Nominal harus bilangan bulat >= 1';
  }
  return null;
}

/** Label status payout Bahasa Indonesia untuk UI. */
export function payoutStatusLabel(status: PayoutStatus): string {
  switch (status) {
    case 'requested':
      return 'Diajukan';
    case 'approved':
      return 'Disetujui';
    case 'rejected':
      return 'Ditolak';
    case 'paid':
      return 'Dibayar';
    default:
      return status;
  }
}
