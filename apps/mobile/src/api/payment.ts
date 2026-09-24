/**
 * Helper pembayaran ST-08 (UI only, tanpa API baru).
 *
 * - TTL booking: `BOOKING_TTL_MS = 30 mnt` di
 *   `apps/api/src/bookings/bookings.service.ts` (pending > 30 mnt -> expired).
 *   Countdown booking = createdAt + 30 mnt (label jujur + ajakan refresh
 *   saat kedaluwarsa).
 * - TTL order marketplace: TIDAK ADA di server
 *   (`apps/api/src/marketplace/*` — tidak ada expireDue/TTL; status pending
 *   menunggu webhook Midtrans). Karena itu order TIDAK countdown palsu —
 *   hanya teks menunggu jujur.
 * - Redaksi proteksi jujur: pembayaran via Midtrans, dana diteruskan ke
 *   mitra setelah layanan. JANGAN klaim escrow.
 * - Metode bayar: info statis yg didukung Snap, dipilih di halaman Midtrans
 *   (flow redirect) — JANGAN klaim pilih-di-app.
 */

/** Cermin `BOOKING_TTL_MS` server (30 mnt, keputusan PO BK-03). */
export const BOOKING_PAYMENT_TTL_MS = 30 * 60 * 1000;

/** Batas bayar (ms epoch) dari createdAt ISO + TTL. NaN bila ISO invalid. */
export function paymentDeadlineMs(createdAt: string, ttlMs: number): number {
  const t = Date.parse(createdAt);
  if (Number.isNaN(t)) return NaN;
  return t + ttlMs;
}

/** Sisa waktu bayar (ms, >= 0). NaN bila createdAt invalid. */
export function paymentRemainingMs(
  createdAt: string,
  ttlMs: number,
  nowMs: number = Date.now(),
): number {
  const deadline = paymentDeadlineMs(createdAt, ttlMs);
  if (Number.isNaN(deadline)) return NaN;
  return Math.max(0, deadline - nowMs);
}

/** True bila jendela bayar habis (atau createdAt invalid -> anggap habis? TIDAK: false agar tak salah label; caller tampilkan fallback). */
export function isPaymentExpired(
  createdAt: string,
  ttlMs: number,
  nowMs: number = Date.now(),
): boolean {
  const rem = paymentRemainingMs(createdAt, ttlMs, nowMs);
  if (Number.isNaN(rem)) return false;
  return rem <= 0;
}

/** ms -> "MM:SS" (floor detik). NaN -> "—". */
export function formatCountdown(remainingMs: number): string {
  if (Number.isNaN(remainingMs)) return '—';
  const totalSec = Math.max(0, Math.floor(remainingMs / 1000));
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/** Fraksi sisa 0..1 untuk progress bar (1 = baru dibuat). NaN -> 0. */
export function paymentProgress(
  createdAt: string,
  ttlMs: number,
  nowMs: number = Date.now(),
): number {
  const rem = paymentRemainingMs(createdAt, ttlMs, nowMs);
  if (Number.isNaN(rem) || ttlMs <= 0) return 0;
  return Math.min(1, Math.max(0, rem / ttlMs));
}

/** Teks proteksi jujur (tanpa klaim escrow). */
export const PAYMENT_PROTECTION = {
  title: 'Pembayaran aman via Midtrans',
  message:
    'Pembayaran aman via Midtrans • Dana diteruskan ke mitra setelah layanan. ' +
    'Status lunas muncul otomatis setelah server mengonfirmasi.',
} as const;

/** Info statis metode yg didukung Snap — dipilih di halaman Midtrans. */
export interface SnapPayMethodInfo {
  id: string;
  badge: string;
  label: string;
}

export const SNAP_PAY_METHODS_INFO: SnapPayMethodInfo[] = [
  { id: 'qris', badge: 'QRIS', label: 'QRIS' },
  { id: 'va', badge: 'VA', label: 'Virtual Account bank' },
  { id: 'wallet', badge: 'E-W', label: 'E-wallet yang tampil di Snap' },
  { id: 'retail', badge: 'Ritel', label: 'Gerai retail yang tampil di Snap' },
];

export const SNAP_METHODS_NOTE =
  'Metode dipilih di halaman Midtrans (bukan di aplikasi ini). ' +
  'Daftar di atas info umum; opsi final tampil di halaman pembayaran.';

/**
 * Salin teks bayar.
 * Clipboard lib BELUM dipasang (cek package.json mobile: tidak ada
 * `@react-native-clipboard/clipboard`; Clipboard inti RN sudah dilepas) —
 * coba Clipboard legacy bila ada, else false -> caller fallback TEKS
 * SELECTABLE + instruksi salin manual.
 */
// TODO(ST-08): pasang @react-native-clipboard/clipboard lalu pakai langsung di sini.
export function tryCopyText(text: string): boolean {
  try {
    const req = (globalThis as { require?: (id: string) => any }).require;
    if (typeof req !== 'function') return false;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const RN = req('react-native') as { Clipboard?: { setString?: (s: string) => void } };
    if (RN?.Clipboard?.setString) {
      RN.Clipboard.setString(text);
      return true;
    }
  } catch {
    // abaikan — fallback salin manual
  }
  return false;
}
