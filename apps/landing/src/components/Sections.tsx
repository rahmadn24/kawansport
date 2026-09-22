import { B2B_COMMISSION_TEXT, B2B_PERKS, FAQS, FEATURES, HOW_IT_WORKS, PAIN_POINTS, SPORTS_MARQUEE, STORE_LINKS, TESTIMONIALS } from '@/lib/content';

function Icon({ name }: { name: string }) {
  const common = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, 'aria-hidden': true } as const;
  switch (name) {
    case 'elo':
      return (<svg {...common}><circle cx="12" cy="8" r="5" /><path d="M8.5 12.5 7 22l5-3 5 3-1.5-9.5" /></svg>);
    case 'booking':
      return (<svg {...common}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 9h18M9 14l2 2 4-4" /></svg>);
    case 'event':
      return (<svg {...common}><path d="M8 21h8M12 17v4M17 4H7v5a5 5 0 0 0 10 0V4Z" /><path d="M17 5h3v5a3 3 0 0 1-3 3M7 5H4v5a3 3 0 0 0 3 3" /></svg>);
    case 'chat':
      return (<svg {...common}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" /></svg>);
    case 'rating':
      return (<svg {...common}><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1L12 2Z" /></svg>);
    default:
      return (<svg {...common}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4H6Z" /><path d="M3 6h18M16 10a4 4 0 0 1-8 0" /></svg>);
  }
}

export function Marquee() {
  const items = [...SPORTS_MARQUEE, ...SPORTS_MARQUEE];
  return (
    <div className="marquee" aria-label="Cabang olahraga populer">
      <div className="marquee__track">
        {items.map((s, i) => (
          <span className="marquee__pill" key={`${s}-${i}`} aria-hidden={i >= SPORTS_MARQUEE.length}>
            ● {s}
          </span>
        ))}
      </div>
    </div>
  );
}

export function PainPoints() {
  return (
    <section className="section" aria-labelledby="masalah-title">
      <div className="container">
        <header className="section-header reveal">
          <span className="eyebrow">Masalah → Solusi</span>
          <h2 id="masalah-title">Main olahraga di Indonesia itu ribet. Kami bereskan.</h2>
        </header>
        <div className="grid grid--3">
          {PAIN_POINTS.map((p) => (
            <article className="card pain-card reveal" key={p.pain}>
              <p className="pain-card__pain">😟 {p.pain}</p>
              <h3>✅ Solusi KawanSport</h3>
              <p>{p.solution}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Features() {
  return (
    <section className="section section--alt" id="fitur" aria-labelledby="fitur-title">
      <div className="container">
        <header className="section-header reveal">
          <span className="eyebrow">Fitur unggulan</span>
          <h2 id="fitur-title">Satu aplikasi untuk semua kebutuhan mainmu</h2>
          <p className="section-header__desc">Dari cari lawan sampai belanja gear — semuanya terhubung dalam satu akun KawanSport.</p>
        </header>
        <div className="grid grid--3">
          {FEATURES.map((f) => (
            <article className="card reveal" key={f.title}>
              <div className="card__icon" aria-hidden="true"><Icon name={f.icon} /></div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HowItWorks() {
  return (
    <section className="section" id="cara-kerja" aria-labelledby="cara-title">
      <div className="container">
        <header className="section-header reveal">
          <span className="eyebrow">Cara kerja</span>
          <h2 id="cara-title">Mulai main dalam 3 langkah</h2>
        </header>
        <div className="grid grid--3">
          {HOW_IT_WORKS.map((s) => (
            <article className="card how reveal" key={s.step}>
              <div className="how__num" aria-hidden="true">{s.step}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Testimonials() {
  return (
    <section className="section section--alt" id="testimoni" aria-labelledby="testi-title">
      <div className="container">
        <header className="section-header reveal">
          <span className="eyebrow">Testimoni</span>
          <h2 id="testi-title">Kata mereka yang sudah main bareng</h2>
        </header>
        <div className="grid grid--4">
          {TESTIMONIALS.map((t) => (
            <article className="card quote reveal" key={t.name}>
              <div className="quote__stars" role="img" aria-label="Rating 5 dari 5">★★★★★</div>
              <p className="quote__text">“{t.quote}”</p>
              <div className="quote__who">
                <span className="avatar" aria-hidden="true">{t.name.charAt(0)}</span>
                <div>
                  <strong>{t.name}</strong>
                  <span>{t.meta}<br />{t.venue}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function B2BBand() {
  return (
    <section className="section" id="venue-b2b" aria-labelledby="b2b-title">
      <div className="container">
        <div className="b2b reveal">
          <div>
            <span className="eyebrow">Untuk pemilik venue 🏟</span>
            <h2 id="b2b-title" style={{ color: '#fff' }}>Slot kosong jadi cuan. Venue-mu ramai tiap hari.</h2>
            <p style={{ marginTop: 12 }}>
              Daftarkan venue-mu dan terima booking dari ribuan pemain di sekitarmu. {B2B_COMMISSION_TEXT}
            </p>
            <span className="placeholder-tag">PLACEHOLDER: teks komisi — ganti via B2B_COMMISSION_TEXT di content.ts</span>
            <div style={{ display: 'flex', gap: 12, marginTop: 22, flexWrap: 'wrap' }}>
              <a href={STORE_LINKS.webRegister} className="btn btn--accent btn--lg">Daftarkan Venue-mu →</a>
              <a href="#faq" className="btn btn--outline-light btn--lg">Tanya dulu</a>
            </div>
          </div>
          <div className="b2b__panel">
            <strong style={{ color: '#fff' }}>Yang kamu dapat:</strong>
            <ul>
              {B2B_PERKS.map((p) => (
                <li key={p}><span className="b2b__check">✔</span> {p}</li>
              ))}
            </ul>
            <a href={STORE_LINKS.webRegister} className="btn btn--primary btn--full">Mulai verifikasi gratis (2×24 jam)</a>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Faq() {
  return (
    <section className="section section--alt" id="faq" aria-labelledby="faq-title">
      <div className="container">
        <header className="section-header reveal">
          <span className="eyebrow">FAQ</span>
          <h2 id="faq-title">Pertanyaan yang sering ditanyakan</h2>
        </header>
        <div className="faq reveal">
          {FAQS.map((f) => (
            <details key={f.q} name="ks-faq">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
