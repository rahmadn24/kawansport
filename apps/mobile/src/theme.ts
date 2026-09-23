/**
 * KawanSport Design System v1 — token terpusat untuk mobile (UX-02).
 * Mengacu ke docs/design/ui-ux-system.md. Seluruh layar batch UX-02
 * WAJIB import warna/spacing/radius/tipografi dari sini — tidak ada
 * hex tercecer di screen.
 */

export const COLORS = {
  brand950: '#052E1B',
  brand900: '#0A4D2E',
  brand700: '#15803D',
  brand600: '#16A34A',
  brand100: '#DCFCE7',
  lime: '#A3E635',
  accent: '#F97316',
  accentSoft: '#FFEDD5',
  navy: '#0B1B33',
  star: '#F59E0B',
  ink: '#0F172A',
  muted: '#475569',
  faint: '#64748B',
  line: '#E2E8F0',
  bg: '#FFFFFF',
  bgAlt: '#F6FAF7',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  tealPaid: '#115E59',
  tealPaidBg: '#CCFBF1',
  fullFg: '#7E22CE',
  fullBg: '#F3E8FF',
  pendingFg: '#854D0E',
  pendingBg: '#FEF9C3',
  expiredFg: '#475569',
  expiredBg: '#F1F5F9',
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  screen: 20,
  xl: 24,
} as const;

export const RADIUS = {
  sm: 8,
  md: 14,
  lg: 20,
  full: 9999,
} as const;

export const TYPO = {
  display: { fontSize: 30, fontWeight: '800' as const },
  title: { fontSize: 22, fontWeight: '800' as const },
  cardTitle: { fontSize: 16, fontWeight: '700' as const },
  section: { fontSize: 15, fontWeight: '700' as const },
  body: { fontSize: 14, fontWeight: '400' as const },
  sub: { fontSize: 13, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '600' as const },
  chip: { fontSize: 13, fontWeight: '700' as const },
  angka: { fontSize: 18, fontWeight: '800' as const },
} as const;

/**
 * Fallback hero venue/produk batch UX-03 (Stitch): gradasi hijau solid +
 * inisial — FOTO ASLI belum ada, JANGAN foto palsu.
 */
// TODO(ST-01): ganti foto asli dari API media.
export const HERO = {
  from: COLORS.brand950,
  to: COLORS.brand700,
} as const;

/** Format tanggal ke "03 Okt 2026, 09.00 WIB" (id-ID, Asia/Jakarta). */
export function formatWIB(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Jadwal menyusul';
  try {
    const parts = new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Jakarta',
    }).format(d);
    return `${parts} WIB`;
  } catch {
    return d.toLocaleString('id-ID');
  }
}

/**
 * Samarkan pesan teknis server menjadi kalimat ramah Bahasa Indonesia.
 * Pesan yang sudah ramah (tanpa pola teknis) diteruskan apa adanya.
 */
export function friendlyServerError(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const msg = raw.trim();
  if (!msg) return null;
  const low = msg.toLowerCase();
  if (/network|request failed|timeout|timed out|fetch|failed to fetch|econn|socket|500|502|503/.test(low)) {
    return 'Jaringan bermasalah. Periksa koneksi lalu coba lagi.';
  }
  if (/unauthorized|401/.test(low)) return 'Email atau password salah. Coba lagi.';
  if (/forbidden|403/.test(low)) return 'Aksi ini tidak diizinkan untuk akunmu.';
  if (/not found|404/.test(low)) return 'Data tidak ditemukan. Muat ulang daftar.';
  if (/conflict|409|already|slot.*(penuh|habis)|full/.test(low)) {
    return 'Slot sudah penuh atau kamu sudah terdaftar.';
  }
  return msg;
}

/** Inisial fallback avatar dari nama/email, mis. "Andi" -> "A", "Andi Budi" -> "AB". */
export function initialsOf(name?: string | null, email?: string): string {
  const src = (name ?? '').trim() || (email ?? '').trim();
  if (!src) return '?';
  const local = src.includes('@') ? src.split('@')[0] : src;
  const words = local.replace(/[_.-]+/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Label jarak Indonesia: "850 m" / "1,1 km" / "Jarak —". */
export function formatKm(meters?: number | null): string {
  if (meters == null || !Number.isFinite(meters)) return 'Jarak —';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} km`;
}
