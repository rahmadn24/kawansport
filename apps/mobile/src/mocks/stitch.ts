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

// ST-08 SELESAI: countdown live dari createdAt + TTL server 30 mnt
// (src/api/payment.ts + UICountdownBanner). Konstanta statis di bawah
// TIDAK dipakai layar lagi — dipertahankan agar impor lama tak rusak.
// TODO: hapus setelah semua consumer dimigrasi.
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

/** Label metode bayar (statis UI).
 * ST-08: layar checkout TIDAK lagi radio pilih-di-app (flow redirect) —
 * pakai UISnapMethods (info statis "dipilih di halaman Midtrans").
 * Tipe + konstanta dipertahankan agar impor lama tak rusak.
 */
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

/* ---------- Batch UX-04 (chat + rating + misc) ---------- */

/** Banner event spesial di feed: STATIS display-only, bukan promo server. */
// TODO(ST-09): ganti API search/banner — banner + klaim slot dari server.
export const STITCH_EVENT_BANNER = {
  title: 'Mabar Akbar Akhir Pekan',
  message: 'Bonus jersey eksklusif & kawan baru anti canggung!',
  cta: 'Klaim Slot Kamu',
};

/** Form rating kaya (aspek/tag/foto) DISEMBUNYIKAN sampai API ada. */
// TODO(ST-06): ganti API review kaya — aspek, tag sorotan, foto suasana.
export const STITCH_RATING_RICH_HIDDEN = true;

/** Badge verifikasi profil DISEMBUNYIKAN (jangan tampilkan badge palsu). */
// TODO(ST-07): ganti API profil sosial — verifikasi komunitas.
export const STITCH_PROFILE_VERIFIED_HIDDEN = true;

/** Stat sosial profil (total mabar, game selesai, bintang) DISEMBUNYIKAN. */
// TODO(ST-07): ganti API profil sosial (depend EL-00/EL-04 utk riwayat/achievement).
export const STITCH_PROFILE_STATS_HIDDEN = true;

/** Badge prestasi / riwayat / circle profil DISEMBUNYIKAN. */
// TODO(ST-07): ganti API profil sosial — badge, riwayat main, circle teman.
export const STITCH_PROFILE_SOCIAL_HIDDEN = true;

/** Rating venue di kartu list DISEMBUNYIKAN (belum ada di DTO list). */
// TODO(ST-06): ganti API rating venue — tampilkan rata-rata + jumlah ulasan.
export const STITCH_VENUE_RATING_HIDDEN = true;

/** Biaya event di kartu feed DISEMBUNYIKAN (event berbayar butuh ST-02). */
// TODO(ST-02): ganti API event berbayar — biaya per orang dari server.
export const STITCH_EVENT_FEE_HIDDEN = true;

/** Ikon olahraga statis untuk chip feed (presentasi, bukan data). */
export const STITCH_SPORT_ICONS: Record<string, string> = {
  badminton: '🏸',
  futsal: '⚽',
  basket: '🏀',
  padel: '🎾',
  tenis: '🎾',
  voli: '🏐',
  default: '🏅',
};

/** Ikon olahraga berdasar nama (case-insensitive, fallback trofi). */
export function sportIconOf(sport: string): string {
  const low = sport.toLowerCase();
  for (const key of Object.keys(STITCH_SPORT_ICONS)) {
    if (key !== 'default' && low.includes(key)) return STITCH_SPORT_ICONS[key];
  }
  return STITCH_SPORT_ICONS.default;
}

/** Copy proteksi lama (klaim garansi).
 * ST-08: layar checkout pakai PAYMENT_PROTECTION jujur
 * (src/api/payment.ts — tanpa klaim escrow). Konstanta dipertahankan agar
 * impor lama tak rusak.
 */
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

/** Waktu relatif Indonesia dari ISO: "baru saja", "5 mnt", "2 jam", "kemarin", "12 Agu". */
export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const diffMs = Date.now() - t;
  if (diffMs < 0) return 'baru saja';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'baru saja';
  if (mins < 60) return `${mins} mnt`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam`;
  if (hours < 48) return 'kemarin';
  try {
    const d = new Date(t);
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(d);
  } catch {
    return '';
  }
}

/** Jam "14:32" (WIB) dari ISO untuk bubble chat. */
export function formatClockWIB(iso: string | null | undefined): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Jakarta',
    }).format(new Date(t));
  } catch {
    return '';
  }
}
