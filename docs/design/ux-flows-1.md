# UX-02 Spec: Auth, Event, Partner

Dokumen redesign untuk Trello #58. Mengacu penuh ke Design System v1 di docs/design/ui-ux-system.md. Token warna, tipografi, spacing, radius, dan 14 komponen inti dipakai apa adanya. Scope hanya auth, event, partner, profil. Booking, marketplace, chat, rating tidak diubah.

Prinsip lintas layar batch ini: primer hijau brand-700, satu CTA oranye accent per layar konversi, chip aktif hijau, fokus input ring brand-100, error selalu ikon + teks Bahasa Indonesia, padding layar 20, kartu putih radius-lg padding 16, target sentuh 44x44.

---

### Gate Auth (App.tsx Gate)

- **Kondisi kini:** Gate hanya switch login/register dengan spinner tengah, tanpa brand, tanpa AppBar, tanpa hierarki error.
- **Layout baru:** [Splash/Gate hero] -> Logo mark + judul KawanSport + slogan Main bareng, naik level -> Card form (LoginScreen atau RegisterScreen di dalam) -> Teksfooter + ghost CTA ganti mode -> Banner error server bila ada.
  Copy: judul hero KawanSport, sub Cari sparing, booking lapangan, kawan main. Footer: Belum punya akun? Daftar / Sudah punya akun? Masuk.
- **States:** loading: initializing tampil Skeleton hero + spinner kecil, bukan layar kosong. empty: tidak ada. error: Banner danger-soft di atas Card form dengan kalimat ramah + tombol Coba lagi, pesan teknis disembunyikan. sukses: otomatis masuk ke BottomTabs tab Event, Toast sukses hijau Selamat datang kembali / Akun dibuat, ayo main.
- **Interaksi:** Maks 2 ketuk ke aksi utama (isi + Masuk/Daftar). Fokus keyboard otomatis ke Email saat layar tampil, Enter pindah Email -> Password -> submit. Toggle mode tidak menghapus email yang sudah diketik.
- **Aksesibilitas:** Label Masuk ke KawanSport, Daftar akun KawanSport, Email, Password, Beralih ke pendaftaran, Beralih ke masuk. Error dibacakan screen reader, ikon + teks.
- **Batasan API:** Hanya field yang ada: POST /auth/login dengan email + password, POST /auth/register dengan email + password + displayName opsional. Respons hanya accessToken, refreshToken, user. Jangan rancang username, nomor HP, OTP, login sosial.

### BottomTabs Shell (App.tsx LoggedIn)

- **Kondisi kini:** 6 Button native berjajar sempit, tidak ada indikasi tab aktif, tidak ada AppBar, badge unread tidak ada, avatar profil tidak ada.
- **Layout baru:** [AppBar global tipis] -> [Konten tab aktif] -> [BottomTabs]. 6 destinasi ikon + label Indonesia: Event, Booking, Shop, Partner, Chat, Profil. Tab aktif brand-700 + indikator lime, Chat ada Badge unread merah maks 99+, Profil memakai Avatar kecil. AppBar judul mengikuti tab.
- **States:** loading: konten tiap tab punya skeleton sendiri, tab bar tetap interaktif. sukses: pindah tab memberi umpan balik visual aktif + Toast info navy bila dari deep-link.
- **Interaksi:** Maks 1 ketuk pindah tab. Deep-link tetap konsumsi sekali lalu dibersihkan. Dari EventDetail ke Booking via Book Court tetap 1 ketuk.
- **Aksesibilitas:** Label Tab Event/Booking/Shop/Partner/Chat (+jumlah belum dibaca)/Profil. State aktif diumumkan, bukan hanya warna.
- **Batasan API:** Shell tidak memanggil API sendiri. Jangan tambah field tab baru.

### LoginScreen (LoginScreen.tsx)

- **Kondisi kini:** Tanpa identitas brand, input hanya placeholder tanpa label, tanpa toggle password, error ditumpuk.
- **Layout baru:** [AppBar sederhana Kembali bila dari Register] -> Hero ringkas logo + judul Masuk + sub Lanjut main bareng kawan -> Input Email -> Input Password + tombol Lihat di kanan dalam -> Banner error server bila ada -> Button primer hijau full-width lg Masuk -> Ghost Belum punya akun? Daftar -> Teks kecil Lupa password? Hubungi admin (tanpa alur).
- **States:** loading: Button spinner disabled + teks Memeriksa akun. error: inline (Email wajib diisi, Password wajib diisi, Format email tidak valid) + Banner server Email atau password salah. sukses: Toast hijau + navigasi ke Event.
- **Interaksi:** Validasi inline saat blur dan submit. Fokus: email-address, next ke password, password submit. Toggle lihat password.
- **Aksesibilitas:** Label Kolom email/password, Tampilkan/Sembunyikan password, Tombol Masuk. Ring fokus lime 3px.
- **Batasan API:** Hanya email trim + password ke login di AuthContext. Tanpa displayName/remember-me.

### RegisterScreen (RegisterScreen.tsx)

- **Kondisi kini:** Aturan password hanya placeholder, tanpa indikator/konfirmasi, tombol biru di luar brand.
- **Layout baru:** [AppBar Kembali ke Masuk] -> Hero Buat Akun + sub Kenalan dulu, biar gampang diajak sparing -> Input Nama tampilan opsional -> Input Email -> Input Password + toggle + meter kekuatan -> Input Ulasan password -> Aturan checklist -> Button primer hijau Daftar -> Ghost Sudah punya akun? Masuk.
  Copy aturan: Minimal 8 karakter, Ada huruf dan angka, Konfirmasi sama. Meter: Lemah / Cukup / Kuat.
- **States:** loading: spinner Memproses pendaftaran. error: inline per field + Banner server (Email sudah dipakai. Coba Masuk.). sukses: Toast Akun jadi. Lengkapi profil biar gampang diajak.
- **Interaksi:** Validasi saat mengetik (konfirmasi/kekuatan), blur (email). Fokus Nama -> Email -> Password -> Konfirmasi. Konfirmasi hanya cek klien.
- **Aksesibilitas:** Label tiap kolom + meter berlabel teks.
- **Batasan API:** Kirim email trim, password, displayName trim/undefined ke POST /auth/register. Tanpa olahraga/skill/lokasi/avatar/telepon.

### EventListScreen (EventListScreen.tsx)

- **Kondisi kini:** Chip biru melanggar brand, kartu teks saja, tombol Buat Event mudah terlewat.
- **Layout baru:** [AppBar Event + aksi Refresh ikon] -> Chip filter horizontal (Semua + SPORT_SUGGESTIONS) -> Meta hasil (12 event • Futsal) -> FlatList Card event -> FAB/Button oranye Buat Event sticky bawah.
  Card: Badge OPEN hijau / FULL ungu + judul + meta olahraga + tanggal WIB + Sisa X dari Y + jarak + host (Sapa: Andi). Ketuk kartu ke Detail.
- **States:** loading: 4 Skeleton kartu; refresh = pull-to-refresh. empty: EmptyState + CTA Buat Event. error: Banner + Muat ulang. sukses: Toast info opsional.
- **Interaksi:** Filter 1 ketuk, detail 1 ketuk, buat 1 ketuk. Chip ≥40px, selalu ada Semua.
- **Aksesibilitas:** Label saring per sport, kartu (judul+status+sisa slot), Buat Event. Badge teks + ikon.
- **Batasan API:** GET /events filter sport. Field: id, sport, title, datetime, capacity, participantsCount, status, host, distanceMeters. slotsLeft = capacity - participantsCount. Tanpa foto/harga/alamat/rating.

### EventDetailScreen (EventDetailScreen.tsx)

- **Kondisi kini:** Satu kartu panjang, koordinat mentah, tombol sejajar tanpa prioritas.
- **Layout baru:** [AppBar Kembali + Detail Event + Refresh] -> Header Card (Badge + judul + meta + host Avatar/nama) -> Section Peserta (Sisa X dari Y + progres) -> Section Detail (deskripsi + lokasi tanpa koordinat mentah + info booking) -> List peserta (Avatar + nama + tanda host) -> Sticky bottom: primer Join / outline Keluar / disabled FULL / ghost Book Court.
- **States:** loading: Skeleton header + 3 baris peserta. empty: Belum ada peserta. error: Banner + Coba lagi; joinError inline + Coba lagi. sukses: Toast + refresh otomatis.
- **Interaksi:** Join/Leave 1 ketuk; konfirmasi Leave ringan; Join disabled jelas saat FULL.
- **Aksesibilitas:** Label judul/status/sisa slot/tombol/daftar peserta. FULL sebagai teks.
- **Batasan API:** Field EventDetail yang ada; jangan tampilkan snapToken/redirectUrl/amount; tanpa komentar/rating/foto.

### CreateEventScreen (CreateEventScreen.tsx)

- **Kondisi kini:** Waktu ISO manual, lat/lng manual, tanpa ringkasan.
- **Layout baru:** [AppBar Kembali + Buat Event] -> S1 Olahraga (chip single + custom) -> S2 Detail (Judul cth Sparing Sabtu Pagi + Deskripsi opsional) -> S3 Waktu (date+time picker native, ringkasan WIB, simpan ISO) -> S4 Lokasi (GPS 1 ketuk, lat/lng disembunyikan, manual fallback) -> S5 Kapasitas (stepper, 2–500) -> Card Ringkasan -> Button oranye Buat Event + ghost Batal.
- **States:** loading: spinner Menyimpan event. error: inline per section + Banner server. sukses: Toast + navigasi List + refresh + highlight baru.
- **Interaksi:** Validasi = validateCreateEvent. Fokus berurutan. GPS 1 ketuk.
- **Aksesibilitas:** Label tiap input + tombol.
- **Batasan API:** CreateEventInput saja (sport, title, description?, datetime ISO, lat/lng, capacity). Tanpa venueId/harga/foto/alamat/privasi.

### SearchPartnerScreen (SearchPartnerScreen.tsx)

- **Kondisi kini:** Filter + hasil satu scroll panjang, Invite placeholder, tanpa visual kecocokan.
- **Layout baru:** [AppBar Cari Partner] -> Card Filter (Olahraga chip + Semua; Skill Segmented; Jarak preset 1/5/10/25/50 km; Lokasi GPS + status) -> Button primer Cari -> Meta hasil -> FlatList Card partner -> Muat lagi.
  Card: Avatar inisial + nama + Chip olahraga (max 3) + Badge skill + jarak + tombol primer Sapa/Chat + sekunder Invite.
- **States:** loading: 3 Skeleton; Muat lagi spinner bawah. empty awal & empty hasil + CTA. error: Banner + Coba lagi; GPS error terpisah; lat/lng berpasangan inline. sukses/notice: Notice bar navy untuk Invite (fitur penuh segera hadir); Chat navigasi ke room bila tersedia.
- **Interaksi:** Cari 1 ketuk; Sapa 1 ketuk; preset jarak 1 ketuk; GPS tanpa ketik koordinat.
- **Aksesibilitas:** Label semua filter + kartu + tombol. Skill/jarak selalu teks.
- **Batasan API:** GET /users/search (sport, skill, lat, lng, radius 100–100000, page, limit). Tanpa rating/umur/gender/online. Invite = notice lokal (belum ada endpoint).

### Profil View (App.tsx Profile)

- **Kondisi kini:** Tumpukan teks, koordinat mentah, tombol setara.
- **Layout baru:** [AppBar Profil Saya + Edit] -> Card Profil (Avatar 64 inisial + nama + email + Badge skill + Chip olahraga max 4 + status lokasi tanpa koordinat) -> Card Pratinjau Partner -> Aksi (Edit primer, Refresh ghost, Keluar danger ghost).
- **States:** loading: Skeleton. empty: field kosong + CTA. error: Banner + Coba lagi. sukses: Toast tersimpan.
- **Interaksi:** Edit 1 ketuk; Logout + konfirmasi.
- **Aksesibilitas:** Label foto/nama/email/skill/olahraga/lokasi/tombol.
- **Batasan API:** UserProfile /me saja. Tanpa lat/lng mentah, statistik, rating.

### EditProfileScreen (EditProfileScreen.tsx)

- **Kondisi kini:** Chip biru, lat/lng manual dominan, tanpa pratinjau.
- **Layout baru:** [AppBar Kembali + Edit Profil + Simpan] -> Avatar row -> Nama -> Olahraga (multi + custom) -> Skill Segmented + deskripsi -> Lokasi (status + GPS + manual collapsed) -> Pratinjau live -> Simpan primer + Batal ghost sticky.
- **States:** loading/saving/GPS spinner; error inline berpasangan + Banner server + gpsError; sukses Toast + kembali otomatis.
- **Interaksi:** Validasi lat/lng berpasangan; custom sport case-insensitive; GPS 1 ketuk.
- **Aksesibilitas:** Label semua input + tombol.
- **Batasan API:** UpdateProfileInput saja. Tanpa email/id/avatar upload (read-only).

## Catatan implementasi

- Jangan ubah logic API/kontrak DTO, navigasi state-based App.tsx, tone/token system.
- Jangan tambah field di luar API; jangan tampilkan data mentah (koordinat, ISO, token, ID, pesan teknis).
- Dependensi: SPORT_SUGGESTIONS bersama; SKILL_LABELS bersama; Avatar fallback bersama.
- Alur: create→refresh list; join/leave→refresh detail; chat lanjut tanpa navigasi palsu; save→refresh profil.
- Aksesibilitas tidak dikorbankan: 44x44, kontras, status teks+ikon, error ikon+teks Indonesia.
