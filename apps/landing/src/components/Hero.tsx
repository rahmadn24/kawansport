'use client';

import { BRAND, SOCIAL_PROOF, STORE_LINKS } from '@/lib/content';

export function Hero() {
  return (
    <section className="hero" id="beranda" aria-labelledby="hero-title">
      <div className="hero__mesh" aria-hidden="true" />
      <div className="container hero__grid">
        <div className="reveal">
          <span className="hero__badge">🏸 {BRAND.tagline} — platform olahraga komunitas</span>
          <h1 id="hero-title" className="hero__title">
            Cari lawan <span className="hl">main bareng</span> yang selevel, booking lapangan 1 menit
          </h1>
          <p className="hero__sub">
            KawanSport mencocokkan kamu dengan lawan setara ELO, slot venue real-time, dan event komunitas di
            kotamu. Main lebih sering, naik level lebih cepat — tanpa drama cari teman main.
          </p>
          <div className="hero__ctas">
            <a href={STORE_LINKS.android} className="btn btn--primary btn--lg" target="_blank" rel="noopener noreferrer">
              ⬇ Download App
            </a>
            <a href={STORE_LINKS.venueRegister} className="btn btn--accent btn--lg">
              🏟 Daftarkan Venue-mu
            </a>
          </div>
          <p className="hero__note">Gratis unduh · Tanpa kartu kredit · Untuk pemain & pemilik venue di {BRAND.domain}</p>
          <div className="proof" role="list" aria-label="Bukti sosial KawanSport">
            {SOCIAL_PROOF.map((s) => (
              <div className="proof__card reveal" role="listitem" key={s.label}>
                <div className="proof__value">{s.value}</div>
                <div className="proof__label">{s.label}</div>
                <div className="proof__note">{s.note}</div>
              </div>
            ))}
          </div>
          <span className="placeholder-tag">PLACEHOLDER: angka social proof (~) — ganti via src/lib/content.ts → SOCIAL_PROOF</span>
        </div>

        <div className="phone-stage reveal" aria-label="Pratinjau aplikasi KawanSport">
          <div className="float-chip float-chip--a" aria-hidden="true">
            ⚡ ELO 1.450 <small>naik 32 poin minggu ini</small>
          </div>
          <div className="phone" role="img" aria-label="Mockup aplikasi KawanSport: daftar lawan sparing dan tombol booking">
            <div className="phone__screen" aria-hidden="true">
              <div className="phone__notch" aria-hidden="true" />
              <div className="phone__body">
                <div className="phone__appbar">
                  <span>⚡ KawanSport</span>
                  <span aria-hidden="true">🔔</span>
                </div>
                <div className="phone__search">🔍 Cari lawan · venue · event…</div>
                <div className="match-card">
                  <strong>🏸 Sparing Badminton · ELO 1400–1500</strong>
                  <span>● 3 lawan cocok dekatmu</span>
                  <em>Besok 19.00 · Jaya Raya Hall · 0,8 km</em>
                </div>
                <div className="match-card">
                  <strong>⚽ Futsal 5v5 · butuh 2 pemain</strong>
                  <span>● Slot live · Rp25rb/orang</span>
                  <em>Malam ini 21.00 · Prime Futsal</em>
                </div>
                <div className="match-card">
                  <strong>🏃 Fun Run 5K · 180 peserta</strong>
                  <span>● Sabtu · tiket Rp35rb</span>
                  <em>Start 05.30 · Balai Kota</em>
                </div>
                <div className="phone__cta">Booking Sekarang →</div>
              </div>
            </div>
          </div>
          <div className="float-chip float-chip--b" aria-hidden="true">
            ✅ Booking lunas <small>Prime Futsal · Lap 2 · 21.00</small>
          </div>
        </div>
      </div>
    </section>
  );
}
