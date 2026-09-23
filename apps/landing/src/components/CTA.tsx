import { BRAND, STORE_LINKS } from '@/lib/content';

export function CTA() {
  return (
    <section className="section" id="download" aria-labelledby="cta-title">
      <div className="container">
        <div className="final-cta reveal">
          <div>
            <span className="eyebrow">Gabung revolusi olahraga komunitas</span>
            <h2 id="cta-title" style={{ color: '#fff' }}>Siap keringetan &amp; main bareng akhir pekan ini?</h2>
            <p>Unduh KawanSport gratis. Temukan partner baru, sewa lapangan tanpa ribet, dan rasakan atmosfer kompetisi sehat di kotamu — {BRAND.tagline}.</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <a href={STORE_LINKS.ios} className="btn btn--accent btn--lg" target="_blank" rel="noopener noreferrer">
                📱 Download di App Store
              </a>
              <a href={STORE_LINKS.android} className="btn btn--outline-light btn--lg" target="_blank" rel="noopener noreferrer">
                ▶ Download di Google Play
              </a>
            </div>
            <p style={{ fontSize: '0.82rem', marginTop: 16, marginBottom: 0 }}>
              TODO-WEB link store: setel env NEXT_PUBLIC_IOS_APP_STORE_URL / NEXT_PUBLIC_ANDROID_PLAY_STORE_URL saat app live.
            </p>
          </div>
          <div className="final-cta__qr" aria-label="Kode QR unduhan aplikasi (ilustrasi)">
            <div className="qr-mock" aria-hidden="true"><b>K</b></div>
            <strong>Scan untuk unduh</strong>
            <span>Buka kamera ponselmu</span>
          </div>
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
              {BRAND.tagline} — platform pencocokan sparing dan reservasi lapangan untuk komunitas olahraga aktif di
              Indonesia.
            </p>
            <p style={{ marginTop: 12, fontSize: '0.92rem' }}>
              📧 <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>
              <br />🌐 {BRAND.domain}
            </p>
          </div>
          <nav aria-label="Eksplorasi">
            <h3>Eksplorasi</h3>
            <ul>
              <li><a href="#fitur">Cari Lawan Sparing</a></li>
              <li><a href="#fitur">Booking Lapangan</a></li>
              <li><a href="#komunitas">Jadwal Main Bareng</a></li>
              <li><a href="#komunitas">Turnamen Komunitas</a></li>
            </ul>
          </nav>
          <nav aria-label="Mitra Lapangan">
            <h3>Mitra Lapangan</h3>
            <ul>
              <li><a href="#venue-b2b">Gabung Mitra Venue</a></li>
              <li><a href="#venue-b2b">CMS Pengelola Lapangan</a></li>
              <li><a href="#faq">Komisi &amp; FAQ</a></li>
              <li><a href={STORE_LINKS.whatsapp} target="_blank" rel="noopener noreferrer">Pusat Bantuan Mitra</a></li>
            </ul>
          </nav>
          <nav aria-label="Unduh Aplikasi">
            <h3>Unduh Aplikasi</h3>
            <ul>
              <li><a href={STORE_LINKS.ios} target="_blank" rel="noopener noreferrer">📱 App Store</a></li>
              <li><a href={STORE_LINKS.android} target="_blank" rel="noopener noreferrer">▶ Google Play</a></li>
              <li><a href="https://instagram.com/kawansport.id" target="_blank" rel="noopener noreferrer">Instagram</a></li>
              <li><a href="https://tiktok.com/@kawansport.id" target="_blank" rel="noopener noreferrer">TikTok</a></li>
            </ul>
          </nav>
        </div>
        <div className="footer__bottom">
          <span>© {new Date().getFullYear()} PT Kawan Olahraga Indonesia · {BRAND.domain} · Hak cipta dilindungi.</span>
          <span><a href="#faq">Syarat &amp; Ketentuan</a> · <a href="#faq">Kebijakan Privasi</a> · <a href="#faq">Bantuan CS</a></span>
        </div>
      </div>
    </footer>
  );
}
