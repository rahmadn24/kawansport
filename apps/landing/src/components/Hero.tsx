import { BRAND, SOCIAL_PROOF, STORE_LINKS } from '@/lib/content';

const valueClass = (i: number) =>
  i === 0 ? 'stats-card__value' : i === 2 ? 'stats-card__value stats-card__value--orange' : 'stats-card__value stats-card__value--ink';

export function Hero() {
  return (
    <section className="hero" id="beranda" aria-labelledby="hero-title">
      <div className="hero__mesh" aria-hidden="true" />
      <div className="container">
        <div className="hero__grid">
          <div className="reveal">
            <span className="hero__live">
              <span className="dot" aria-hidden="true" />
              #1 Athletic Matchmaking &amp; Court Booking
            </span>
            <h1 id="hero-title" className="hero__title">
              Satu Aplikasi untuk Cari Lawan Sparing, <span className="hl">Booking Lapangan</span>, &amp; Komunitas
              Olahraga
            </h1>
            <p className="hero__sub">
              Platform sosial olahraga #1 di Indonesia. Temukan lawan setara ELO, reservasi venue tanpa antre, dan
              tingkatkan sportivitas bersama — {BRAND.tagline}.
            </p>
            <div className="hero__ctas">
              <a href={STORE_LINKS.android} className="btn btn--accent btn--lg" target="_blank" rel="noopener noreferrer">
                ⬇ Unduh Aplikasi Gratis
              </a>
              <a href={STORE_LINKS.venueRegister} className="btn btn--outline btn--lg">
                🏟 Daftarkan Venue Lapanganmu
              </a>
            </div>
            <div className="store-pills" aria-label="Tautan unduhan resmi">
              <span>Tersedia resmi di:</span>
              <a className="store-pill" href={STORE_LINKS.ios} target="_blank" rel="noopener noreferrer">
                📱 iOS App Store
              </a>
              <a className="store-pill" href={STORE_LINKS.android} target="_blank" rel="noopener noreferrer">
                ▶ Google Play
              </a>
            </div>
            <p className="hero__note">Gratis unduh · Tanpa kartu kredit · Untuk pemain &amp; pemilik venue di {BRAND.domain}</p>
          </div>

          {/* Visual: kartu event "Live Radar" ala Stitch — murni CSS, tanpa gambar eksternal */}
          <div className="phone-stage reveal" aria-label="Pratinjau aplikasi KawanSport">
            <div className="live-card" role="img" aria-label="Pratinjau aplikasi: event sparing terkonfirmasi dengan slot tersisa dan harga per orang">
              <div className="live-card__head" aria-hidden="true">
                <span className="live-card__title">
                  <span className="pulse-dot" /> KawanSport Live Radar
                </span>
                <span className="live-card__radius">GBK · 5 km</span>
              </div>
              <div className="event-visual" aria-hidden="true">
                <div className="event-visual__lines" />
                <div className="event-visual__body">
                  <span className="event-visual__tag">Sparing Terkonfirmasi</span>
                  <strong>Smash Seru · Lapangan 3</strong>
                  <small>Malam ini, 19.30–21.30 WIB</small>
                </div>
              </div>
              <div className="slot-card" aria-hidden="true">
                <div className="slot-card__row">
                  <span className="ok">Slot tersisa</span>
                  <span className="hot">1 orang lagi!</span>
                </div>
                <div className="progress">
                  <div className="progress__fill" />
                </div>
                <div className="slot-card__meta">
                  <span className="avatar-stack">
                    <i style={{ background: '#15803d' }}>DS</i>
                    <i style={{ background: '#f97316' }}>AP</i>
                    <i style={{ background: '#0b1b33' }}>BW</i>
                    <i style={{ background: '#64748b' }}>+4</i>
                  </span>
                  {/* TODO-WEB: harga contoh ilustrasi */}
                  <span className="slot-price">~Rp35rb<small>/org</small></span>
                </div>
              </div>
              <div className="pin-grid" aria-hidden="true">
                <div className="pin">
                  <span className="pin__ic">✓</span>
                  <span><b>Jaminan Host</b><small>100% main pasti</small></span>
                </div>
                <div className="pin">
                  <span className="pin__ic">▦</span>
                  <span><b>Gate Check-in</b><small>Scan &amp; main</small></span>
                </div>
              </div>
              <div className="float-badge" aria-hidden="true">
                <span className="float-badge__ic">◉</span>
                <span><b>Matchmaker Pintar</b><strong>~98% klop</strong></span>
              </div>
            </div>
          </div>
        </div>

        <div className="stats-strip reveal">
          <div className="stats-card" role="list" aria-label="Statistik KawanSport (ilustrasi)">
            {SOCIAL_PROOF.map((s, i) => (
              <div role="listitem" key={s.label}>
                <div className={valueClass(i)}>{s.value}</div>
                <div className="stats-card__label">{s.label}</div>
              </div>
            ))}
          </div>
          <span className="placeholder-tag">TODO-WEB: angka statistik ilustrasi — ganti via SOCIAL_PROOF di src/lib/content.ts</span>
        </div>
      </div>
    </section>
  );
}
