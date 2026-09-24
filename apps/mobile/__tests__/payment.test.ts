/**
 * ST-08: countdown bayar jujur + redaksi proteksi/metode.
 * Murni (tanpa render RN) agar hijau di preset react-native.
 */
import {
  BOOKING_PAYMENT_TTL_MS,
  PAYMENT_PROTECTION,
  SNAP_METHODS_NOTE,
  SNAP_PAY_METHODS_INFO,
  formatCountdown,
  isPaymentExpired,
  paymentDeadlineMs,
  paymentProgress,
  paymentRemainingMs,
  tryCopyText,
} from '../src/api/payment';
import { payRemainingLabel } from '../src/components/payment';

const CREATED = '2030-06-17T09:00:00Z';
const T = Date.parse(CREATED);

describe('payment utils (ST-08)', () => {
  it('TTL booking 30 menit (cermin BOOKING_TTL_MS server)', () => {
    expect(BOOKING_PAYMENT_TTL_MS).toBe(30 * 60 * 1000);
  });

  it('deadline = createdAt + TTL', () => {
    expect(paymentDeadlineMs(CREATED, BOOKING_PAYMENT_TTL_MS)).toBe(T + 30 * 60 * 1000);
    expect(paymentDeadlineMs('asal', BOOKING_PAYMENT_TTL_MS)).toBeNaN();
  });

  it('remaining berkurang terhadap now; habis -> 0 + expired true', () => {
    expect(paymentRemainingMs(CREATED, BOOKING_PAYMENT_TTL_MS, T + 60 * 1000)).toBe(
      29 * 60 * 1000,
    );
    expect(isPaymentExpired(CREATED, BOOKING_PAYMENT_TTL_MS, T + 60 * 1000)).toBe(false);
    expect(paymentRemainingMs(CREATED, BOOKING_PAYMENT_TTL_MS, T + 31 * 60 * 1000)).toBe(0);
    expect(isPaymentExpired(CREATED, BOOKING_PAYMENT_TTL_MS, T + 31 * 60 * 1000)).toBe(true);
    expect(paymentRemainingMs(CREATED, BOOKING_PAYMENT_TTL_MS, T)).toBe(30 * 60 * 1000);
  });

  it('createdAt invalid -> NaN/false (JANGAN label salah)', () => {
    expect(paymentRemainingMs('asal', BOOKING_PAYMENT_TTL_MS, T)).toBeNaN();
    expect(isPaymentExpired('asal', BOOKING_PAYMENT_TTL_MS, T)).toBe(false);
    expect(formatCountdown(NaN)).toBe('—');
  });

  it('formatCountdown MM:SS floor', () => {
    expect(formatCountdown(29 * 60 * 1000 + 500)).toBe('29:00');
    expect(formatCountdown(14 * 60 * 1000 + 59 * 1000)).toBe('14:59');
    expect(formatCountdown(0)).toBe('00:00');
  });

  it('progress 1 saat baru -> 0 saat habis', () => {
    expect(paymentProgress(CREATED, BOOKING_PAYMENT_TTL_MS, T)).toBe(1);
    expect(paymentProgress(CREATED, BOOKING_PAYMENT_TTL_MS, T + 15 * 60 * 1000)).toBeCloseTo(
      0.5,
    );
    expect(paymentProgress(CREATED, BOOKING_PAYMENT_TTL_MS, T + 60 * 60 * 1000)).toBe(0);
  });

  it('payRemainingLabel jujur: sisa + TTL; habis -> ajakan refresh', () => {
    expect(payRemainingLabel(CREATED, BOOKING_PAYMENT_TTL_MS, T + 60 * 1000)).toContain(
      '29:00',
    );
    expect(payRemainingLabel(CREATED, BOOKING_PAYMENT_TTL_MS, T + 60 * 1000)).toContain(
      '30 mnt',
    );
    expect(payRemainingLabel(CREATED, BOOKING_PAYMENT_TTL_MS, T + 60 * 60 * 1000)).toContain(
      'muat ulang',
    );
  });

  it('proteksi jujur: sebut Midtrans, tanpa klaim escrow', () => {
    expect(PAYMENT_PROTECTION.title).toContain('Midtrans');
    expect(PAYMENT_PROTECTION.message).toContain('Midtrans');
    expect(PAYMENT_PROTECTION.message.toLowerCase()).not.toContain('escrow');
    expect(PAYMENT_PROTECTION.message).not.toContain('100%');
  });

  it('metode jujur: dipilih di halaman Midtrans, bukan di app', () => {
    expect(SNAP_PAY_METHODS_INFO.length).toBeGreaterThan(0);
    expect(SNAP_METHODS_NOTE).toContain('halaman Midtrans');
    expect(SNAP_METHODS_NOTE).toContain('bukan di aplikasi');
  });

  it('tryCopyText false tanpa Clipboard (fallback salin manual)', () => {
    expect(tryCopyText('BK-123')).toBe(false);
  });
});
