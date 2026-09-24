/**
 * API voucher promo + Poin Kawan (ST-04): tipe mirror server + helper klien.
 *
 * Server tidak punya endpoint validasi terpisah — voucher diterapkan langsung
 * via `POST /bookings` / `POST /checkout` (`{ voucherCode, usePoints }`) dan
 * snapshot hasilnya (`subtotal, discount, voucherCode, pointsUsed`) dibaca
 * dari `BookingItem` / `ShopOrder`. Saldo poin dibaca dari `GET /me`.
 */

import { api } from './client';
import {
  BookEventInput,
  CreateBookingInput,
  bookEventCourt,
  createBooking,
} from './bookings';
import { CheckoutOptions, ShopOrder, checkoutCart } from './shop';

export type VoucherType = 'percent' | 'fixed';
export type VoucherScope = 'booking' | 'shop' | 'all';

export interface VoucherItem {
  id: string;
  code: string;
  type: VoucherType;
  value: number;
  maxDiscount: number | null;
  minTransaction: number;
  quota: number | null;
  perUserLimit: number | null;
  usedCount: number;
  validFrom: string | null;
  validTo: string | null;
  applicableTo: VoucherScope;
  active: boolean;
}

interface Http {
  get<T>(url: string): Promise<{ data: T }>;
}

/** Normalisasi kode voucher (server menyimpan uppercase). */
export function normalizeVoucherCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Validasi format kode sisi klien; kembalikan pesan error atau null bila valid.
 * Validasi bisnis (kuota, masa berlaku, minimal transaksi) tetap di server
 * saat booking/checkout — error server ditampilkan jujur oleh UI.
 */
export function validateVoucherCode(code: string): string | null {
  const c = code.trim();
  if (!c) return 'Kode voucher wajib diisi';
  if (!/^[A-Za-z0-9_-]{3,32}$/.test(c)) {
    return 'Kode voucher 3–32 karakter (huruf/angka/-/_)';
  }
  return null;
}

/** GET /me → saldo Poin Kawan (1 poin = Rp1). */
export async function getLoyaltyBalance(http: Http = api): Promise<number> {
  const res = await http.get<{ loyaltyPoints?: number | null }>('/me');
  return res.data.loyaltyPoints ?? 0;
}

/** Format poin: 1500 -> "1.500 poin (= Rp1.500)". */
export function formatPoints(points: number): string {
  const n = Math.round(points).toLocaleString('id-ID');
  return `${n} poin (= Rp${n})`;
}

/** Booking langsung + voucher/poin (POST /bookings). */
export async function applyVoucherToBooking(
  input: CreateBookingInput,
  http: Parameters<typeof createBooking>[1] = api,
) {
  return createBooking(
    {
      ...input,
      ...(input.voucherCode
        ? { voucherCode: normalizeVoucherCode(input.voucherCode) }
        : {}),
    },
    http,
  );
}

/** Booking dari event + voucher/poin (POST /events/:id/book). */
export async function applyVoucherToEventBooking(
  eventId: string,
  input: BookEventInput,
  http: Parameters<typeof bookEventCourt>[2] = api,
) {
  return bookEventCourt(
    eventId,
    {
      ...input,
      ...(input.voucherCode
        ? { voucherCode: normalizeVoucherCode(input.voucherCode) }
        : {}),
    },
    http,
  );
}

/** Checkout cart + voucher/poin (POST /checkout). */
export async function applyVoucherToCheckout(
  options: CheckoutOptions,
  http: Parameters<typeof checkoutCart>[0] = api,
): Promise<ShopOrder> {
  return checkoutCart(http, {
    ...options,
    ...(options.voucherCode
      ? { voucherCode: normalizeVoucherCode(options.voucherCode) }
      : {}),
  });
}
