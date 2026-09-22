import { BRAND, STORE_LINKS } from '@/lib/content';

export function CTA() {
  return (
    <section className="section" id="download" aria-labelledby="cta-title">
      <div className="container">
        <div className="final-cta reveal">
          <h2 id="cta-title" style={{ color: '#fff' }}>Siap main bareng akhir pekan ini?</h2>
          <p>Unduh KawanSport, cari lawan selevel dalam 1 menit, dan rasakan bedanya: {BRAND.tagline}.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href={STORE_LINKS.android} className="btn btn--primary btn--lg" target="_blank" rel="noopener noreferrer">
              ⬇ Google Play
            </a>
            <a href={STORE_LINKS.ios} className="btn btn--outline-light btn--lg" target="_blank" rel="noopener noreferrer">
              App Store
            </a>
          </div>
          <p style={{ fontSize: '0.82rem', marginTop: 16 }}>
            PLACEHOLDER link store: setel env NEXT_PUBLIC_ANDROID_PLAY_STORE_URL / NEXT_PUBLIC_IOS_APP_STORE_URL saat app live.
          </p>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="footer" role="contentinfo">
      <div className="container">
        <div className="footer__grid">
          <div>
            <a href="#beranda" className="brand" style={{ color: '#fff' }} aria-label={`${BRAND.name} — Beranda`}>
              <span className="brand__mark" aria-hidden="true">⚡</span>
              <span>{BRAND.name}</span>
            </a>
            <p style={{ marginTop: 12, fontSize: '0.92rem' }}>
              {BRAND.tagline} — cari lawan, booking lapangan, ikut event & liga, dan belanja gear. Buatan Indonesia,
              untuk komunitas Indonesia.
            </p>
            <p style={{ marginTop: 12, fontSize: '0.92rem' }}>
              📧 <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>
              <br />🌐 {BRAND.domain}
            </p>
          </div>
          <nav aria-label="Produk">
            <h3>Produk</h3>
            <ul>
              <li><a href="#fitur">Cari Lawan ELO</a></li>
              <li><a href="#fitur">Booking Real-time</a></li>
              <li><a href="#fitur">Event & Liga</a></li>
              <li><a href="#fitur">Marketplace</a></li>
            </ul>
          </nav>
          <nav aria-label="Venue">
            <h3>Venue</h3>
            <ul>
              <li><a href="#venue-b2b">Daftarkan Venue</a></li>
              <li><a href="#faq">Komisi & FAQ</a></li>
              <li><a href="#cara-kerja">Cara Kerja</a></li>
            </ul>
          </nav>
          <nav aria-label="Perusahaan">
            <h3>Ikuti kami</h3>
            <ul>
              <li><a href="https://instagram.com/kawansport.id" target="_blank" rel="noopener noreferrer">Instagram</a></li>
              <li><a href="https://tiktok.com/@kawansport.id" target="_blank" rel="noopener noreferrer">TikTok</a></li>
              <li><a href="https://youtube.com/@kawansport" target="_blank" rel="noopener noreferrer">YouTube</a></li>
            </ul>
          </nav>
        </div>
        <div className="footer__bottom">
          <span>© {new Date().getFullYear()} {BRAND.name} · {BRAND.domain} · Hak cipta dilindungi.</span>
          <span><a href="#faq">Syarat & Ketentuan</a> · <a href="#faq">Kebijakan Privasi</a></span>
        </div>
      </div>
    </footer>
  );
}
