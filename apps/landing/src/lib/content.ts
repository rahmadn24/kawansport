/**
 * KAWANSPORT — Single source of truth untuk copy, angka, dan link landing.
 *
 * PLACEHOLDER YANG PERLU DIGANTI USER:
 *  - SOCIAL_PROOF stats (venue/pemain/kota) → angka realistis diawali "~", update berkala
 *  - B2B_COMMISSION_TEXT → teks komisi venue owner (masih draft, konfirmasi bisnis)
 *  - STORE_LINKS via env NEXT_PUBLIC_IOS_APP_STORE_URL / NEXT_PUBLIC_ANDROID_PLAY_STORE_URL
 *  - CONTACT email halo@kawansport.id bila berubah
 */

export const BRAND = {
  name: 'KawanSport',
  tagline: 'main bareng, naik level',
  domain: 'kawansport.id',
  email: 'halo@kawansport.id',
  locale: 'id_ID' as const,
};

export const STORE_LINKS = {
  // GANTI via env saat store live. Default "#" agar tidak 404.
  ios: process.env.NEXT_PUBLIC_IOS_APP_STORE_URL ?? '#',
  android: process.env.NEXT_PUBLIC_ANDROID_PLAY_STORE_URL ?? '#',
  webRegister: 'https://kawansport.id/register',
  webLogin: 'https://kawansport.id/login',
  venueRegister: '#venue-b2b',
};

/** PLACEHOLDER — ganti angka setelah data produksi tersedia. Semua diawali "~". */
export const SOCIAL_PROOF = [
  { value: '~1.200+', label: 'Venue mitra', note: 'futsal · badminton · basket · tenis' },
  { value: '~48.000+', label: 'Pemain terdaftar', note: 'komunitas aktif mingguan' },
  { value: '~24', label: 'Kota/kabupaten', note: 'Jawa · Sumatera · Bali' },
] as const;

export const SPORTS_MARQUEE = [
  'Badminton',
  'Futsal',
  'Basket',
  'Tenis',
  'Voli',
  'Lari',
  'Sepak Bola',
  'Padel',
  'Tenis Meja',
  'Renang',
] as const;

export const PAIN_POINTS = [
  {
    pain: 'Susah cari lawan yang sepadan',
    solution: 'Cari Lawan ELO — difilter level, lokasi, dan jadwal. Lawan setara, main makin seru.',
  },
  {
    pain: 'Booking lapangan ribet & double-book',
    solution: 'Booking real-time — slot live, bayar digital, konfirmasi instan. Anti antre, anti PHP.',
  },
  {
    pain: 'Venue sepi di jam off-peak',
    solution: 'Dashboard venue — atur harga peak/off-peak, pantau okupansi, isi slot kosong otomatis.',
  },
] as const;

export const FEATURES = [
  {
    icon: 'elo',
    title: 'Cari Lawan setara ELO',
    desc: 'Matchmaking adil berbasis rating. Menang naik level, kalah tetap dapat lawan seimbang.',
  },
  {
    icon: 'booking',
    title: 'Booking real-time',
    desc: 'Lihat slot live, booking & bayar dalam 1 menit. Notifikasi pengingat H-1 otomatis.',
  },
  {
    icon: 'event',
    title: 'Event & Liga',
    desc: 'Ikut sparing rutin, fun match, sampai liga komunitas. Bikin event sendiri juga bisa.',
  },
  {
    icon: 'chat',
    title: 'Chat tim & lawan',
    desc: 'Koordinasi jadwal, share lokasi venue, dan atur formasi tanpa pindah aplikasi.',
  },
  {
    icon: 'rating',
    title: 'Rating venue transparan',
    desc: 'Review jujur soal karpet, lampu, parkir, dan wasit. Pilih venue tanpa zonk.',
  },
  {
    icon: 'market',
    title: 'Marketplace gear',
    desc: 'Raket, sepatu, jersey original dari seller terverifikasi. Ada cicilan & garansi.',
  },
] as const;

export const HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Unduh & pilih gayamu',
    desc: 'Daftar 30 detik, pilih olahraga favorit dan levelmu — santai, aktif, atau kompetitif.',
  },
  {
    step: '2',
    title: 'Cari lawan & booking',
    desc: 'Filter lawan setara ELO, pilih venue terdekat, booking slot real-time.',
  },
  {
    step: '3',
    title: 'Main bareng, naik level',
    desc: 'Main, kasih rating, kumpulkan XP. Menang terus? Masuk papan liga kotamu.',
  },
] as const;

export const TESTIMONIALS = [
  {
    name: 'Rizky Pratama',
    meta: 'Pemain badminton · Jakarta Selatan',
    venue: 'Main rutin di Jaya Raya Hall',
    quote:
      'Biasanya susah cari lawan selevel. Di KawanSport sekali tap langsung dapat 3 ajakan sparing. ELO-nya akurat!',
  },
  {
    name: 'Sinta Maharani',
    meta: 'Kapten tim futsal putri · Bandung',
    venue: 'Langganan Prime Futsal Bandung',
    quote:
      'Booking buat satu tim nggak pakai drama lagi. Slot live, bayar patungan, semua terima notif. Hemat 1 jam tiap minggu.',
  },
  {
    name: 'Andi Wijaya',
    meta: 'Pemilik venue · Surabaya',
    venue: 'AW Sport Center, 4 court',
    quote:
      'Slot weekday siang yang dulu kosong sekarang keisi komunitas lari & padel. Okupansi naik tanpa pasang iklan.',
  },
  {
    name: 'Dewi Lestari',
    meta: 'Pelari & EO mini-race · Yogyakarta',
    venue: 'Event lari 5K & 10K',
    quote: 'Bikin event lari 200 peserta tanpa spreadsheet. Pendaftaran, pembayaran, dan pengumuman dalam satu link.',
  },
] as const;

/** Komisi resmi venue owner (keputusan bisnis 2026-09-23): flat 5%. */
export const B2B_COMMISSION_TEXT =
  'Komisi flat 5% per booking lunas — tanpa biaya pendaftaran, tanpa biaya bulanan.';

export const B2B_PERKS = [
  'Dashboard okupansi & pendapatan real-time',
  'Atur harga peak / off-peak per lapangan',
  'Promosi slot kosong ke komunitas sekitar',
  'Pencairan D+1 ke rekening venue',
] as const;

export const FAQS = [
  {
    q: 'Apakah KawanSport gratis?',
    a: 'Ya, aplikasi gratis untuk pemain. Kamu hanya bayar saat booking lapangan, ikut event berbayar, atau belanja gear. Tidak ada biaya langganan tersembunyi.',
  },
  {
    q: 'Bagaimana sistem lawan setara (ELO) bekerja?',
    a: 'Setiap selesai main, kedua tim saling memberi rating sportivitas + hasil skor tercatat. Sistem menghitung ELO-mu per cabang olahraga, lalu mencocokkan lawan dalam rentang ±100 poin.',
  },
  {
    q: 'Metode pembayaran apa saja yang didukung?',
    a: 'QRIS, transfer bank (VA), e-wallet (GoPay, OVO, DANA, ShopeePay), dan kartu kredit/debit. Semua pembayaran diproses gateway berlisensi.',
  },
  {
    q: 'Saya pemilik venue — bagaimana cara bergabung?',
    a: 'Klik "Daftarkan Venue-mu", isi data lapangan dan foto, lalu tim kami verifikasi max 2×24 jam. Setelah approved, venue langsung tampil dan bisa menerima booking.',
  },
  {
    q: 'Berapa komisi untuk venue owner?',
    a: 'Komisi flat 5% dari setiap booking lunas. Early partner yang daftar sebelum launching gratis komisi 3 bulan pertama.',
  },
  {
    q: 'Apakah data saya aman?',
    a: 'Kami menyimpan data di infrastruktur terenkripsi, tidak menjual data ke pihak ketiga, dan kamu bisa menghapus akun beserta datanya kapan pun via Pengaturan.',
  },
] as const;

export const NAV_LINKS = [
  { href: '#fitur', label: 'Fitur' },
  { href: '#cara-kerja', label: 'Cara Kerja' },
  { href: '#testimoni', label: 'Testimoni' },
  { href: '#venue-b2b', label: 'Untuk Venue' },
  { href: '#faq', label: 'FAQ' },
] as const;
