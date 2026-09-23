# Stitch: Adopsi PENUH (keputusan PO 2026-09-23, update dari merge parsial)

Sumber: `docs/stitch_kawansport_mobile_app_ui/` (13 layar). Review 7 layar kunci.
Keputusan: adopsi 100% desain Stitch. API yang belum ada dibangun sebagai epic ST (backlog #61–70).

## Urutan bangun (API dulu, UI menyusul per flow)
1. ST-01 Media (unlock foto semua layar) + ST-04 Voucher/Poin (dipakai 2 checkout)
2. ST-02 Event berbayar + ST-03 Waiting list
3. ST-08 Checkout kaya + ST-05 Marketplace kaya + ST-10 Fasilitas/sewa alat
4. ST-06 Review kaya + ST-07 Profil sosial (depend EL-00/EL-04 utk riwayat/achievement)
5. ST-09 Search/banner/map
6. UX-03/UX-04 full-Stitch setelah API per flow siap (tanpa fallback palsu)

## Sementara (sebelum API siap): JANGAN tampilkan data palsu
Fallback yang diizinkan: gradasi + inisial (foto), sembunyikan section (sewa alat, voucher) — bukan angka/btn bohong.

## Yang diadopsi visual (sudah/akan tanpa backend baru — UX-02 + batch berikut)
- CTA pill full-radius (oranye konversi, hijau sekunder) — ganti radius-md 14 di `ui.tsx`.
- Chip aktif navy + teks putih + dot lime (ganti chip aktif hijau).
- Slot progress bar (fill hijau >40%, oranye <3 sisa) di kartu event.
- Sticky bottom bar (total + Lanjut Bayar) di booking checkout; FAB "Buat Mabar".
- Microcopy Stitch ("Sisa 3 dari 12", "Sapa: Andi", "Jum, 19.00–21.00").

## Yang dibangun via epic ST (dulu "ditunda", kini dikerjakan — #61–70)
- Foto venue/event asli: ST-01 (sementara gradasi + inisial).
- Sewa alat & pelengkap: ST-10.
- Waiting list event penuh: ST-03.
- Map view: ST-09. Search bar global + banner promo: ST-09. Label fasilitas per court: ST-10.

## Token yang dikunci (gabungan, tidak konflik)
Hijau `#15803D/#16A34A`, lime `#A3E635`, oranye `#F97316`, navy `#0B1B33`, amber `#F59E0B`, ink `#0F172A`, bg `#FFFFFF/#F6FAF7` — Stitch dan system v1 SAMA. Beda hanya di radius CTA (pill menang) dan chip aktif (navy menang).
