import { BadRequestException } from '@nestjs/common';

/**
 * Fasilitas venue/court (ST-10).
 *
 * Allowlist FINAL (keputusan PO): parkir, shower, wifi, kantin, mushola,
 * toilet, loker, tribun. Nilai di luar daftar DITOLAK 400 (bukan di-strip
 * diam-diam) agar typo owner ketahuan, bukan hilang misterius.
 *
 * AD-02: fasilitas = NON-SENSITIF — PATCH langsung berlaku (200) walau
 * venue sudah `approved`, tanpa change request. Alasan: fasilitas adalah
 * info operasional faktual (seperti sports/address), bukan identitas harga/
 * nama yang butuh moderasi.
 */
export const VENUE_FACILITIES = [
  'parkir',
  'shower',
  'wifi',
  'kantin',
  'mushola',
  'toilet',
  'loker',
  'tribun',
] as const;

export type VenueFacility = (typeof VENUE_FACILITIES)[number];

/**
 * Normalisasi + validasi daftar fasilitas.
 * Trim + lowercase + buang kosong + dedupe (jaga urutan).
 * Nilai asing → BadRequestException (400).
 */
export function normalizeFacilities(input: unknown): string[] {
  if (!Array.isArray(input)) {
    throw new BadRequestException('facilities must be an array of strings');
  }
  const allowed = new Set<string>(VENUE_FACILITIES);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    const s = String(raw ?? '')
      .trim()
      .toLowerCase();
    if (!s) continue;
    if (!allowed.has(s)) {
      throw new BadRequestException(
        `Unknown facility "${String(raw).trim()}". Allowed: ${VENUE_FACILITIES.join(', ')}`,
      );
    }
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}
