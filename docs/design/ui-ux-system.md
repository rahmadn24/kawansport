# KawanSport Design System v1

> Brand: KawanSport — "main bareng, naik level". Aplikasi olahraga + sosial modern untuk Indonesia. Selaras tema existing: hijau lapangan + lime energi + oranye CTA + navy malam dari landing dan CMS.

## 1. Fondasi Brand & Tema Existing

Landing (`apps/landing`) adalah sumber kebenaran visual: hijau tua sebagai otoritas, lime sebagai sorotan energi, oranye sebagai aksi konversi, navy untuk malam/premium. CMS (`apps/cms`) menambah semantik status yang matang (pending/approved/paid/open/full). Mobile saat ini **menyimpang**: memakai biru `#1a73e8`, abu `#ccc/#ddd/#888`, dan tombol native — terasa seperti prototipe, bukan KawanSport.

Arah v1: satukan mobile ke token landing + status CMS, pertahankan Bahasa Indonesia santai-sportif ("Sparing Sabtu Pagi", "Sapa dulu!").

## 2. Palet Warna

### 2.1 Warna utama

| Token | Nilai | Pakai untuk |
|---|---|---|
| `brand-950` | `#052E1B` | Latar hero gelap, B2B band, teks di atas lime |
| `brand-900` | `#0A4D2E` | AppBar aktif, logo mark, judul angka proof |
| `brand-700` | `#15803D` | Primer utama tombol, tab aktif, link |
| `brand-600` | `#16A34A` | Gradasi primer, status OPEN / paid |
| `brand-100` | `#DCFCE7` | Latar eyebrow, chip terpilih lembut, fokus input |
| `lime` | `#A3E635` | Aksen energi: sorotan, fokus keyboard, badge rating |
| `accent` | `#F97316` | CTA konversi: Buat Event, Checkout, Bayar |
| `accent-soft` | `#FFEDD5` | Latar peringatan ringan, stub payment |
| `navy` | `#0B1B33` | Latar malam, marquee, phone frame, bottom sheet gelap |
| `star` | `#F59E0B` | Bintang rating, indikator HELD / pending |

### 2.2 Netral & teks

| Token | Nilai | Pakai untuk |
|---|---|---|
| `ink` | `#0F172A` | Judul, teks utama |
| `muted` | `#475569` | Sub-judul, deskripsi |
| `faint` | `#64748B` | Placeholder, meta, tanggal |
| `line` | `#E2E8F0` | Border kartu, divider |
| `bg` | `#FFFFFF` | Latar utama mobile |
| `bg-alt` | `#F6FAF7` | Latar section selang-seling, ringkasan rating |
| `danger` | `#DC2626` | Error, FULL, booked, hapus |
| `danger-soft` | `#FEE2E2` | Latar error banner |
| `teal-paid` | `#115E59` di atas `#CCFBF1` | Status booking lunas |

### 2.3 Aturan pakai warna

- Primer = hijau (`brand-700`), bukan biru. Biru `#1a73e8` yang dipakai semua chip aktif mobile saat ini **wajib diganti**.
- Satu layar maksimal satu tombol oranye; sisanya hijau primer atau ghost.
- Lime hanya untuk fokus, seleksi, dan sorotan — jangan untuk tombol besar.
- Status selalu berpasangan bg + fg dari CMS: open biru, full ungu, paid teal, pending kuning tua, expired abu.
- Teks di atas warna: putih di atas `brand-700/900` dan `accent`; `brand-950` di atas lime.

## 3. Tipografi

| Token | Nilai | Pakai untuk |
|---|---|---|
| `font-sans` | Inter, system-ui, -apple-system, Segoe UI | Seluruh aplikasi |
| `display` | 28–32 / 800 / -0.02em | Judul layar, skor rata-rata besar |
| `title` | 22 / 800, center di layar form | Judul layar mobile — pertahankan ukuran, tambah konsistensi |
| `card-title` | 16 / 700 | Nama venue, event, partner |
| `section` | 15 / 700 | "Lapangan", "Tanggal", "Slot", "Peserta" |
| `body` | 14 / 400 / 1.65 | Deskripsi, komentar review |
| `sub` | 13 / 400, `muted` | Meta: jarak, harga, alamat |
| `caption` | 12 / 600 | Status koneksi chat, char-count, bar-count |
| `chip` | 13 / 700 | Label chip / segmented |
| `angka` | tabular-nums, 18–20 / 800 | Total harga, slot tersisa, skor 4.8 |

Aturan: judul layar selalu satu gaya; jangan campur rata kiri/tengah antar layar. Harga dan tanggal selalu satu format (`Rp`, `dd MMM yyyy HH:mm WIB`).

## 4. Spacing, Radius, Shadow

| Token | Nilai | Pakai untuk |
|---|---|---|
| `space-1` | 4 | Gap dalam chip, bar rating |
| `space-2` | 8 | Gap tombol bersebelahan, composer chat |
| `space-3` | 12 | Padding kartu ringkas, gap vertikal |
| `space-4` | 16 | Padding layar chat, padding kartu |
| `space-6` | 24 | Padding layar standar mobile |
| `radius-sm` | 8 | Input, slot row, tombol kecil |
| `radius-md` | 14 | Tombol utama, kartu review |
| `radius-lg` | 20 | Kartu besar, bottom sheet |
| `radius-full` | 9999 | Chip, badge unread, avatar |
| `shadow-sm` | 0 1 2 rgba(2,32,20,.07) | Kartu list |
| `shadow-md` | 0 8 24 -8 rgba(10,77,46,.22) | Tombol primer, modal |
| `shadow-lg` | 0 24 60 -20 rgba(10,77,46,.35) | Bottom sheet, checkout |

Aturan: padding layar konsisten 20; kartu rapat 12–16; radius chip selalu full; input selalu `radius-sm` dengan border `line`.

## 5. Audit UX Mobile (per Layar)

- **App.tsx — Gate + BottomTabs + flow**: tab memakai 6 `Button` native berjajar yang sempit dan tidak menunjukkan tab aktif; tidak ada AppBar/judul global; deep-link tidak ada umpan balik visual saat pindah tab.
- **LoginScreen**: tanpa identitas brand; input tanpa label dan tanpa toggle lihat password; error lokal dan server ditumpuk tanpa hierarki.
- **RegisterScreen**: aturan password hanya placeholder; tidak ada indikator kekuatan/konfirmasi; tombol native biru di luar brand.
- **EventListScreen**: chip aktif biru melanggar brand; kartu hanya teks; tombol "Buat Event" mudah terlewat.
- **EventDetailScreen**: satu kartu panjang melelahkan; lokasi koordinat mentah; tombol sejajar tanpa prioritas visual.
- **CreateEventScreen**: waktu ISO manual rawan salah; lat/lng manual tanpa peta/GPS; tanpa ringkasan konfirmasi.
- **SearchPartnerScreen**: filter + hasil satu scroll panjang; Invite placeholder; tanpa visual kecocokan level.
- **VenueListScreen**: daftar sport hardcode tidak sinkron; kartu tanpa foto/harga/rating; Refresh duplikatif.
- **VenueDetailScreen**: rating menyela tanggal–slot; strip tanggal + chip memakan ruang; status slot hanya teks warna.
- **CheckoutScreen (booking)**: token/URL mentah tak bisa disalin; tanpa tombol Bayar dominan; pesan stub teknis.
- **MyBookingsScreen**: event tampil ID mentah; tanpa filter status/bayar ulang; error campur.
- **CartScreen**: tombol native kecil sulit diketuk; tanpa gambar produk/pengelompokan toko; tiga tombol setara bobot.
- **MpCheckoutScreen**: identik checkout booking; token/URL mentah; tanpa alur pesanan.
- **MyOrdersScreen**: `map` tanpa virtualisasi; tanpa badge status/pencarian/lacak.
- **ChatListScreen**: tanpa avatar; Refresh menggantikan pull-to-refresh; tanpa waktu/status online.
- **ChatRoomScreen**: bubble lawan kontras rendah tanpa nama/waktu; status "polling" teknis; composer sempit.
- **EditProfileScreen/Profile**: profil tumpukan teks tanpa avatar/kartu; koordinat mentah; tanpa pratinjau kartu partner.
- **RatingReviewScreen**: sort tanpa UI; header panah teks; distribusi skala relatif menyesatkan.
- **RatingStars/FormModal/ReviewCard**: warna di luar brand; modal tertutup saat ketuk overlay; placeholder tanpa fallback inisial.

## 6. Spesifikasi 14 Komponen Inti

1. **Button** — primer hijau gradasi, aksen oranye, outline, ghost, danger. sm 36, md 48, lg 56; full-width di form. Satu primer per layar; loading = spinner; disabled 55% opacity.
2. **Card** — putih, border `line`, `radius-lg`, padding 16, `shadow-sm`. Varian: event, venue, partner, order.
3. **Chip** — full-radius, border `line`, 13/700; aktif bg `brand-700` teks putih (atau `brand-100`/`brand-900` lembut). Target ketuk ≥40px; selalu ada "Semua".
4. **Input** — label 14/600 di atas; border `line`, `radius-sm`, tinggi 48; fokus border `brand-700` + ring `brand-100`. Error: border danger + pesan 13.
5. **Star rating** — aktif `star`, nonaktif `#E2E8F0`; display 16, summary 24–28, input 36/area 44. Setengah untuk rata-rata; label aksesibilitas.
6. **Avatar** — lingkaran 36/44/64; fallback inisial `brand-900` + teks lime. Selalu di chat, partner, review, profil.
7. **Badge** — pill 12/700: OPEN hijau, FULL ungu, paid teal, pending kuning, expired abu, unread merah. Maks "99+"; status = teks + ikon, bukan warna saja.
8. **BottomSheet/Modal** — putih, radius atas 20, pegangan, tutup via X + aksi (jangan hanya overlay). Baku: form rating.
9. **Toast** — bar bawah 14/600, 3 detik: sukses hijau, info navy, error danger-soft. Bukan untuk error validasi form.
10. **Skeleton** — blok `line` berdenyut untuk list awal; spinner hanya untuk aksi.
11. **EmptyState** — ilustrasi + judul + 1 kalimat + 1 CTA, nada copy existing.
12. **Segmented** — untuk Skill, Sort ulasan, filter status booking; aktif hijau.
13. **AppBar** — 56–68, judul 18/800 + kembali + aksi kanan; putih blur + border (atau `brand-950` malam).
14. **BottomTabs** — 6 destinasi ikon + label; aktif `brand-700` + indikator lime; Chat badge unread, Profil avatar.

## 7. Prinsip UX Global

1. **Main bareng dalam 3 ketuk** — Event → Detail → Join; Venue → Slot → Book; Partner → Chat.
2. **Satu bahasa olahraga Indonesia** — tanpa istilah teknis di UI pengguna.
3. **Visual hijau, aksi oranye** — hanya momen konversi yang oranye.
4. **Jujur soal status** — selalu status + aksi berikutnya.
5. **Lokasi tanpa mengetik koordinat** — GPS/pin/nama alamat baku.
6. **Naik level terlihat** — rating/skill/riwayat sebagai progres sosial.

## 8. Peta Redesign per Flow

Lihat UX-02 (auth+event+partner), UX-03 (booking+marketplace), UX-04 (chat+rating+misc) beserta file spec `docs/design/ux-flows-*.md`.

## 9. Aksesibilitas

Kontras ≥4.5:1; target sentuh 44×44; ring fokus lime 3px; Dynamic Type hingga 135%; hormati pengurangan gerak; label aksesibilitas Bahasa Indonesia; error = ikon + teks; sembunyikan pesan teknis dari pengguna akhir.
