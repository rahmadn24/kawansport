/**
 * Mock TERPUSAT batch UX-03 (Stitch) — KawanSport mobile.
 *
 * ATURAN KERAS (keputusan PO 2026-09-23, docs/design/stitch-merge.md):
 * - SEMUA data palsu HANYA boleh tinggal di file ini.
 * - Tiap nilai WAJIB berkomentar // TODO(ST-xx): ganti API <nama>.
 * - JANGAN kirim nilai dari file ini ke server: body request tetap dari
 *   state real (slot yg dipilih, qty cart, dsb).
 * - JANGAN tampilkan angka/tombol bohong yg berinteraksi server: nominal di
 *   tombol bayar/checkout HARUS dari server (booking.amount / cart.total).
 * - Yang belum ada API-nya DISembunyIKAN (sewa alat, fasilitas, voucher,
 *   shipping, badge verified), bukan dipalsukan.
 */
import type { SlotItem } from '../api/venues';
import type { ShopCartLine } from '../api/shop';
import type { BadgeKind } from '../components/ui';

// TODO(ST-08): ganti API rincian checkout kaya — biaya layanan dari server.
export const STITCH_SERVICE_FEE = 2500;

// TODO: hubungkan expiry backend — timer countdown masih statis, bukan sisa waktu nyata.
export const STITCH_COUNTDOWN_LABEL = '14:59';
export const STITCH_COUNTDOWN_PROGRESS = 0.85;

// TODO(ST-04): ganti API voucher/poin — section voucher DISEMBUNYIKAN sampai API ada.
export const STITCH_VOUCHER_HIDDEN = true;

// TODO(ST-10): ganti API fasilitas & sewa alat — kedua section DISEMBUNYIKAN sampai API ada.
export const STITCH_EQUIPMENT_HIDDEN = true;
export const STITCH_FACILITIES_HIDDEN = true;

// TODO(ST-05): ganti API shipping marketplace — section shipping DISEMBUNYIKAN;
// default sementara: ambil di toko.
export const STITCH_SHIPPING_HIDDEN = true;

// TODO(ST-05): ganti API seller verified — badge verified DISEMBUNYIKAN
// (verified selalu false dulu = JANGAN tampilkan badge palsu).
export const STITCH_VERIFIED_BADGE_VISIBLE = false;

// TODO(ST-01): ganti foto asli venue/produk dari API media — sementara
// gradasi hijau + inisial, JANGAN foto palsu.
export const STITCH_PHOTO_FALLBACK_NOTE = 'gradasi + inisial (ST-01)';

/** Label metode bayar (statis UI). Nomor VA/referensi tetap dari snap backend yg ada. */
export interface StitchPayMethod {
  id: string;
  badge: string;
  label: string;
  sub: string;
}

export const STITCH_PAY_METHODS: StitchPayMethod[] = [
  { id: 'bca', badge: 'BCA', label: 'BCA Virtual Account', sub: 'Bebas biaya admin' },
  { id: 'mandiri', badge: 'MDR', label: 'Mandiri Virtual Account', sub: 'Verifikasi instan' },
  { id: 'bri', badge: 'BRI', label: 'BRI Virtual Account (BRIVA)', sub: 'Bisa lewat BRImo' },
  { id: 'qris', badge: 'QRIS', label: 'QRIS SpeedPay', sub: 'GoPay, OVO, Dana, BCA Mobile' },
];

/** Kategori shop + kata kunci filter LOKAL (display-only, tak mengubah server). */
// TODO(ST-09): ganti API search/katalog + kategori server.
export interface StitchCategory {
  label: string;
  keywords: string[];
}

export const STITCH_SHOP_CATEGORIES: StitchCategory[] = [
  { label: 'Semua Gear', keywords: [] },
  { label: 'Badminton', keywords: ['raket', 'shuttlecock', 'kok', 'yonex', 'senar', 'badminton'] },
  { label: 'Futsal', keywords: ['futsal', 'sepatu bola', 'jersey bola', 'bola'] },
  { label: 'Padel & Tenis', keywords: ['padel', 'tenis', 'tennis'] },
  { label: 'Nutrisi', keywords: ['nutrisi', 'suplemen', 'protein', 'vitamin', 'isotonik'] },
];

/** Banner pickup: info statis, bukan janji pengiriman. */
// TODO(ST-05): ganti API marketplace kaya (opsi ambil-di-venue sinkron jadwal).
export const STITCH_PICKUP_BANNER = {
  title: 'Pick-up Kilat Venue',
  message: 'Ambil perlengkapanmu langsung di venue pas tanding!',
};

/** Copy proteksi: teks statis informatif, bukan angka klaim server. */
export const STITCH_PROTECTION = {
  title: 'Jaminan 100% KawanSport Proteksi',
  message:
    'Garansi pengembalian dana 100% apabila terjadi kendala teknis lapangan atau pembatalan cuaca ekstrem hingga 6 jam sebelum jadwal tanding.',
};

/* ---------- Helper MURNI (bukan mock): olah data real dari server ---------- */

/** Kelompokkan slot real per sesi: Pagi (< 12.00) vs Sore & Malam. */
export function groupSlotsBySession<T extends Pick<SlotItem, 'startMinute'>>(slots: T[]): {
  pagi: T[];
  malam: T[];
} {
  const pagi: T[] = [];
  const malam: T[] = [];
  for (const s of slots) {
    if (s.startMinute < 12 * 60) pagi.push(s);
    else malam.push(s);
  }
  return { pagi, malam };
}

/** Durasi slot real (menit) dari startMinute/endMinute server. */
export function slotDurationMinutes(s: Pick<SlotItem, 'startMinute' | 'endMinute'>): number {
  return Math.max(0, s.endMinute - s.startMinute);
}

/** Label durasi Indonesia: 60 -> "1 Jam", 90 -> "1,5 Jam". */
export function slotDurationLabel(s: Pick<SlotItem, 'startMinute' | 'endMinute'>): string {
  const mins = slotDurationMinutes(s);
  if (mins <= 0) return '—';
  if (mins % 60 === 0) return `${mins / 60} Jam`;
  return `${(mins / 60).toLocaleString('id-ID', { maximumFractionDigits: 1 })} Jam`;
}

const WEEKDAY_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

/** YYYY-MM-DD -> "Jum" (hari lokal perangkat). */
export function weekdayShort(dateKey: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!m) return '—';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return '—';
  return WEEKDAY_SHORT[d.getDay()] ?? '—';
}

/** YYYY-MM-DD -> nomor tanggal "24". */
export function dayNumber(dateKey: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  return m ? String(Number(m[3])) : '—';
}

/** Kelompokkan baris cart real per seller (multiseller). */
export function groupCartBySeller(items: ShopCartLine[]): Array<{
  sellerId: string;
  sellerShopName: string;
  lines: ShopCartLine[];
  subtotal: number;
}> {
  const map = new Map<string, { sellerId: string; sellerShopName: string; lines: ShopCartLine[]; subtotal: number }>();
  for (const line of items) {
    const key = line.product.sellerId || line.productId;
    const g = map.get(key) ?? {
      sellerId: line.product.sellerId,
      sellerShopName: line.product.sellerShopName,
      lines: [],
      subtotal: 0,
    };
    g.lines.push(line);
    g.subtotal += line.product.price * line.qty;
    map.set(key, g);
  }
  return [...map.values()];
}

/** Filter lokal cart: query + kategori (display-only, tak menyentuh server). */
export function filterCartLocal(
  items: ShopCartLine[],
  query: string,
  category: StitchCategory,
): ShopCartLine[] {
  const q = query.trim().toLowerCase();
  return items.filter((line) => {
    const name = `${line.product.name} ${line.product.sellerShopName}`.toLowerCase();
    if (q && !name.includes(q)) return false;
    if (category.keywords.length > 0 && !category.keywords.some((k) => name.includes(k))) {
      return false;
    }
    return true;
  });
}

/** Status booking -> varian badge (konsisten CMS). */
export function bookingBadgeKind(status: string): BadgeKind {
  if (status === 'paid') return 'paid';
  if (status === 'pending') return 'pending';
  if (status === 'cancelled') return 'cancelled';
  return 'expired';
}

/** Status order -> varian badge (konsisten CMS). */
export function orderBadgeKind(status: string): BadgeKind {
  if (status === 'paid') return 'paid';
  if (status === 'pending') return 'pending';
  if (status === 'cancelled') return 'cancelled';
  return 'expired';
}
