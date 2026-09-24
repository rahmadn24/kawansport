/**
 * KAWANSPORT landing — single source of truth untuk copy, angka placeholder, dan link.
 *
 * ATURAN PLACEHOLDER (TODO-WEB):
 * - SEMUA angka/metrik (stats, okupansi, rating, harga contoh) = ilustrasi statis,
 *   BUKAN data produksi. Ditandai `TODO-WEB` + diawali "~" bila berupa angka.
 * - SEMUA testimoni = naskah ilustrasi, bukan ulasan terverifikasi. Ditandai `TODO-WEB`.
 * - 100% STATIS: file ini hanya berisi konstanta + process.env (build-time).
 *   DILARANG fetch API / data dinamis dari file ini maupun komponen landing.
 *
 * Yang FINAL (bukan placeholder):
 * - B2B_COMMISSION_TEXT: komisi flat 5% per booking lunas (keputusan bisnis 2026-09-23).
 */

export const BRAND = {
  name: 'KawanSport',
  tagline: 'main bareng, naik level',
  domain: 'kawansport.id',
  email: 'halo@kawansport.id',
  locale: 'id_ID' as const,
};

export const STORE_LINKS = {
  // TODO-WEB: ganti via env saat listing store live. Default "#" agar tidak 404.
  ios: process.env.NEXT_PUBLIC_IOS_APP_STORE_URL ?? '#',
  android: process.env.NEXT_PUBLIC_ANDROID_PLAY_STORE_URL ?? '#',
  webRegister: 'https://kawansport.id/register',
  webLogin: 'https://kawansport.id/login',
  venueRegister: '#venue-b2b',
  // TODO-WEB: ganti nomor CS resmi sebelum tayang.
  whatsapp: 'https://wa.me/6281234567890?text=Halo%20KawanSport%2C%20saya%20mau%20tanya%20soal%20venue.',
};

/* TODO-WEB: angka social proof ilustrasi — ganti setelah data produksi tersedia. */
export const SOCIAL_PROOF = [
  { value: '~14.800+', label: 'Pemain aktif & sparing', note: 'TODO-WEB · ilustrasi' },
  { value: '~520+', label: 'Lapangan terverifikasi', note: 'TODO-WEB · ilustrasi' },
  { value: '~98%', label: 'Matchmaking berhasil', note: 'TODO-WEB · ilustrasi' },
  { value: '~4,9/5', label: 'Rating Play Store & iOS', note: 'TODO-WEB · ilustrasi' },
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

/** 4 pilar fitur sesuai Stitch (matchmaking, booking, komunitas, marketplace). */
export const FEATURES = [
  {
    icon: 'elo',
    eyebrow: 'Algoritma ELO & GPS Proximity',
    title: 'Cari Lawan & Sparing Partner Akurat',
    desc: 'Nggak perlu pusing lawan jomplang. Matchmaking menyeleksi lawan berdasar level (Beginner, Intermediate, Pro), cabor pilihanmu, dan radius terdekat. Menang naik level, kalah tetap dapat lawan seimbang.',
    visual: 'radar' as const,
  },
  {
    icon: 'booking',
    eyebrow: 'Real-time Sync & Split Bill',
    title: 'Booking Lapangan Instan 24/7',
    desc: 'Lihat slot live, booking & bayar dalam 1 menit — tanpa telepon penjaga lapang. Sistem otomatis kunci slot, anti double-booking, plus split-bill patungan via QRIS ke grup WhatsApp.',
    visual: 'slots' as const,
  },
  {
    icon: 'event',
    eyebrow: 'Komunitas Verified & Ramah Pemula',
    title: 'Komunitas Mabar & Open Play',
    desc: 'Teman tongkrongan sering wacana? Gabung sesi Open Play mulai ~Rp35rb/orang (TODO-WEB · harga ilustrasi). Host terverifikasi, kok & air mineral transparan, sistem rotasi adil.',
    visual: 'mabar' as const,
  },
  {
    icon: 'market',
    eyebrow: 'Gear Locker On-Site',
    title: 'Marketplace Gear & Pick-up di Venue',
    desc: 'Kok habis di tengah game atau butuh rompi baru? Pesan apparel, grip, dan bola via Gear Hub dari seller terverifikasi, ambil langsung di resepsionis venue rekanan.',
    visual: 'gear' as const,
  },
] as const;

export const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Pilih Cabor & Lapangan',
    desc: 'Cari lapangan terdekat berdasar jenis lantai (rumput sintetis, vinyl, parket) dan filter fasilitas seperti shower atau kantin.',
  },
  {
    step: '02',
    title: 'Cocokkan Partner / Slot',
    desc: 'Buat jadwal bareng kawan sendiri, ajak tim luar untuk sparing, atau beli 1 tiket slot mabar terbuka.',
  },
  {
    step: '03',
    title: 'Scan QR & Main Sehat!',
    desc: 'Tunjukkan kode booking QR di resepsionis, main, lalu beri rating sportivitas partner bermainmu.',
  },
] as const;

/* TODO-WEB: seluruh testimoni di bawah ini naskah ilustrasi — ganti dengan ulasan terverifikasi sebelum launch. */
export const TESTIMONIALS = [
  {
    // TODO-WEB: testimoni ilustrasi.
    name: 'Dimas Setiawan',
    meta: 'Kapten PB Smash Tebet · Jakarta',
    quote:
      'Dulu cari lawan sparing badminton seimbang susahnya setengah mati di grup WA. Sekarang set filter Intermediate, 10 menit langsung dapat lawan yang klop dan sportif!',
  },
  {
    // TODO-WEB: testimoni ilustrasi.
    name: 'Annisa Putri',
    meta: 'Koordinator futsal · Bandung',
    quote:
      'Split-bill otomatis nyelametin saya dari momen nagih uang kas yang canggung. Semua anak bayar via QRIS sebelum turun lapangan, venue selalu tepat waktu.',
  },
  {
    // TODO-WEB: testimoni ilustrasi.
    name: 'Bambang Wicaksono',
    meta: 'Pemilik venue · Surabaya',
    quote:
      'Slot weekday siang yang dulu kosong sekarang keisi komunitas. Okupansi naik tanpa pasang iklan, pencairan masuk rekening tanpa potongan tersembunyi.',
  },
] as const;

/** Komisi resmi venue owner — FINAL (keputusan bisnis 2026-09-23): flat 5%. */
export const B2B_COMMISSION_TEXT =
  'Komisi flat 5% per booking lunas — tanpa biaya pendaftaran, tanpa biaya bulanan.';

/* TODO-WEB: angka okupansi/pendapatan dashboard B2B = ilustrasi. */
export const B2B_OCCUPANCY_TEXT = '~94% okupansi (TODO-WEB · ilustrasi)';

export const B2B_PERKS = [
  { title: 'Auto Dynamic Pricing', desc: 'Isi jam sepi (pagi/siang) dengan promo otomatis.' },
  { title: 'Pencairan Harian Instan', desc: 'Pendapatan sewa cair tiap hari kerja ke rekening.' },
  { title: 'Nol Double Booking', desc: 'Kalender terpadu sinkron online & walk-in.' },
  { title: 'Pemasaran Komunitas', desc: 'Promosikan turnamen ke komunitas target.' },
] as const;

/* TODO-WEB: metrik panel dashboard B2B = ilustrasi. */
export const B2B_DASHBOARD = {
  venue: 'GOR Cempaka Putih (Minggu Ini)',
  growth: '+28% YoY',
  avgFill: 'Rata-rata ~94% terisi',
  revenueToday: '~Rp4.650.000',
  matchesDone: '18 Laga',
} as const;

/**
 * FAQ gabungan — PERTAHANKAN semua pertanyaan yang sudah tayang (6 existing)
 * + 2 tambahan dari Stitch (cuaca/proteksi, split-bill). JANGAN hapus item existing.
 */
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
    q: 'Bagaimana jika jadwal bentrok atau cuaca buruk (Proteksi 100%)?',
    a: 'Pemesanan lapangan outdoor dan semi-outdoor dilindungi Garansi Cuaca: hujan lebat atau kendala teknis venue bisa dijadwalkan ulang gratis atau saldo kembali 100%.',
  },
  {
    q: 'Bagaimana cara split bill (patungan bayar lapang)?',
    a: "Saat booking, pilih 'Split Bill Otomatis', tentukan jumlah anggota, lalu sistem membuat link patungan berisi QRIS dan Virtual Account. Status pembayaran terpantau live di layar panitia.",
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

/** Product knowledge ringkas — fakta produk final (konsisten dengan FAQ & fitur). */
export const PRODUCT_KNOWLEDGE = [
  {
    // TODO-WEB: ELO (EL-00..EL-05) masih backlog — jangan klaim live sebelum rilis.
    title: 'Level ELO per Cabor (segera hadir)',
    desc: 'Rencana: skill Beginner, Intermediate, atau Pro dihitung terpisah per cabang olahraga dengan matchmaking seimbang. TODO-WEB · roadmap, bukan fitur live.',
  },
  {
    title: 'Pembayaran Terpadu',
    desc: 'QRIS, transfer bank (VA), e-wallet via gateway berlisensi. Opsi final tampil di halaman pembayaran Midtrans.',
  },
  {
    // TODO-WEB: kebijakan reschedule/refund belum ada di backend — roadmap.
    title: 'Perlindungan Jadwal (roadmap)',
    desc: 'Rencana: kendala cuaca atau venue bisa dijadwalkan ulang atau saldo kembali. TODO-WEB · roadmap, syarat & ketentuan menyusul.',
  },
  {
    title: 'Check-in Kode Booking & Rating Sportivitas',
    desc: 'Masuk venue cukup tunjukkan kode booking di resepsionis. Usai main, saling menilai sportivitas untuk menjaga kualitas komunitas.',
  },
] as const;

/** Nav sesuai screenshot + referensi Stitch: Fitur / Cara / Cabor / Komunitas / Venue / FAQ. */
export const NAV_LINKS = [
  { href: '#fitur', label: 'Fitur' },
  { href: '#cara-kerja', label: 'Cara' },
  { href: '#cabor', label: 'Cabor' },
  { href: '#komunitas', label: 'Komunitas' },
  { href: '#venue-b2b', label: 'Venue' },
  { href: '#faq', label: 'FAQ' },
] as const;
