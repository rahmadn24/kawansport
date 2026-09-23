'use client';

import { useState } from 'react';
import {
  B2B_COMMISSION_TEXT,
  B2B_DASHBOARD,
  B2B_OCCUPANCY_TEXT,
  B2B_PERKS,
  FAQS,
  FEATURES,
  HOW_IT_WORKS,
  STORE_LINKS,
  TESTIMONIALS,
} from '@/lib/content';

function Icon({ name }: { name: string }) {
  const common = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, 'aria-hidden': true } as const;
  switch (name) {
    case 'elo':
      return (<svg {...common}><circle cx="12" cy="8" r="5" /><path d="M8.5 12.5 7 22l5-3 5 3-1.5-9.5" /></svg>);
    case 'booking':
      return (<svg {...common}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 9h18M9 14l2 2 4-4" /></svg>);
    case 'event':
      return (<svg {...common}><path d="M8 21h8M12 17v4M17 4H7v5a5 5 0 0 0 10 0V4Z" /><path d="M17 5h3v5a3 3 0 0 1-3 3M7 5H4v5a3 3 0 0 0 3 3" /></svg>);
    default:
      return (<svg {...common}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4H6Z" /><path d="M3 6h18M16 10a4 4 0 0 1-8 0" /></svg>);
  }
}

function FeatureVisual({ kind }: { kind: string }) {
  if (kind === 'radar') {
    return (
      <div className="mini-panel" aria-hidden="true">
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 800 }}>
          <span>Radar sparing aktif</span>
          <span style={{ color: '#15803d' }}>~12 tersedia</span>
        </div>
        <div className="mini-row">
          <span className="mini-row__init" style={{ background: '#dae2fd', color: '#15803d' }}>BDM</span>
          <span><b>PB Garuda Jaya</b><small>Intermediate · 1,8 km</small></span>
        </div>
        <div className="mini-row">
          <span className="mini-row__init" style={{ background: '#ffedd5', color: '#9a3412' }}>FTS</span>
          <span><b>Thunder FC Sparing</b><small>Casual friendly · 3,2 km</small></span>
        </div>
      </div>
    );
  }
  if (kind === 'slots') {
    return (
      <div className="mini-panel" aria-hidden="true">
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700, color: '#64748b' }}>
          <span>Slot Lapangan A — Vinyl Pro</span>
          <span style={{ color: '#15803d', fontWeight: 800 }}>Live</span>
        </div>
        <div className="slot-timeline">
          <span className="slot-t slot-t--off">17.00–18.00</span>
          <span className="slot-t slot-t--active">18.00–19.00</span>
          <span className="slot-t">19.00–20.00</span>
        </div>
        <span className="split-note">◉ Split-bill QRIS &amp; VA instan</span>
      </div>
    );
  }
  if (kind === 'mabar') {
    return (
      <div className="mini-panel" aria-hidden="true">
        <div className="mini-row">
          <span className="mini-row__init" style={{ background: '#0a4d2e' }}>RP</span>
          <span><b>Mabar Rutin Rabu Malam</b><small>Host: Captain Arya (Rating ~4,9 ★)</small></span>
        </div>
      </div>
    );
  }
  return (
    <div className="mini-panel" aria-hidden="true">
      <div className="mini-row">
        <span className="mini-row__init" style={{ background: '#15803d' }}>◉</span>
        <span><b>Shuttlecock Pro</b><small>Ready di ~45 venue</small></span>
      </div>
      <div className="mini-row">
        <span className="mini-row__init" style={{ background: '#f97316' }}>▣</span>
        <span><b>Jersey Sparing</b><small>Kustom nomor &amp; nama</small></span>
      </div>
      <div className="mini-row">
        <span className="mini-row__init" style={{ background: '#0b1b33' }}>✦</span>
        <span><b>Sewa Grip &amp; Raket</b><small>Pick-up resepsionis</small></span>
      </div>
    </div>
  );
}

export function Features() {
  return (
    <section className="section section--alt" id="fitur" aria-labelledby="fitur-title">
      <div className="container">
        <header className="reveal" style={{ marginBottom: 36, maxWidth: 760 }}>
          <span className="eyebrow">Fitur juara KawanSport</span>
          <h2 id="fitur-title">Bikin olahraga rutin jadi jauh lebih gampang &amp; seru</h2>
          <p className="section-header__desc">
            Dari cari lawan selevel sampai booking venue instan tanpa telepon penjaga lapang — tersinkronisasi dalam
            hitungan detik.
          </p>
        </header>
        <div className="bento">
          {FEATURES.map((f, i) => (
            <article className={`bento__card reveal ${i % 2 === 0 ? 'bento__wide' : 'bento__narrow'}`} key={f.title}>
              <div className="card__icon" aria-hidden="true"><Icon name={f.icon} /></div>
              <span className={`bento__tag${f.icon === 'booking' ? ' bento__tag--orange' : ''}`}>{f.eyebrow}</span>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
              <FeatureVisual kind={f.visual} />
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
          <span className="eyebrow">Langkah praktis</span>
          <h2 id="cara-title">3 langkah mudah mulai main hari ini</h2>
          <p className="section-header__desc">Dari rebahan sampai keringetan di lapangan — cuma hitungan sentuhan jari.</p>
        </header>
        <div className="grid grid--3">
          {HOW_IT_WORKS.map((s, i) => (
            <article className="card reveal" key={s.step}>
              <div className="step-num" aria-hidden="true">{s.step}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
              <div className={`step-visual step-visual--${i + 1}`} role="img" aria-label={`Ilustrasi langkah ${s.step}: ${s.title}`}>
                {i === 0 ? '▦' : i === 1 ? '◉' : '▦'}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Testimonials() {
  return (
    <section className="section section--alt" id="komunitas" aria-labelledby="testi-title">
      <div className="container">
        <header className="section-header reveal">
          <span className="eyebrow">Kata komunitas</span>
          <h2 id="testi-title">Cerita atlet &amp; kapten yang naik level bersama kami</h2>
          <p className="section-header__desc">Dari mabar santai tiap minggu sampai langganan juara turnamen amatir.</p>
        </header>
        <div className="grid grid--3">
          {TESTIMONIALS.map((t) => (
            <article className="card quote reveal" key={t.name}>
              <div className="quote__stars" role="img" aria-label="Rating 5 dari 5">★★★★★</div>
              <p className="quote__text">“{t.quote}”</p>
              <div className="quote__who">
                <span className="avatar" aria-hidden="true">{t.name.charAt(0)}</span>
                <div>
                  <strong>{t.name}</strong>
                  <span>{t.meta}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
        <span className="placeholder-tag">TODO-WEB: testimoni ilustrasi — ganti dengan ulasan terverifikasi via TESTIMONIALS di content.ts</span>
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
            <span className="eyebrow">🏟 Solusi pengelola olahraga</span>
            <h2 id="b2b-title" style={{ color: '#fff' }}>Punya gelanggang? Optimalkan okupansi hingga {B2B_OCCUPANCY_TEXT}</h2>
            <p style={{ marginTop: 12 }}>
              Tinggalkan buku catatan manual dan risiko jadwal ganda. Venue CMS menghubungkan gelanggangmu ke ribuan
              pemain siap bayar. {B2B_COMMISSION_TEXT}
            </p>
            <ul style={{ listStyle: 'none', display: 'grid', gap: 12, marginTop: 20 }} aria-label="Keunggulan untuk venue">
              {B2B_PERKS.map((p) => (
                <li key={p.title} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: '0.95rem' }}>
                  <span className="b2b__check" aria-hidden="true">✔</span>
                  <span><strong style={{ color: '#fff' }}>{p.title} — </strong>{p.desc}</span>
                </li>
              ))}
            </ul>
            <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
              <a href={STORE_LINKS.webRegister} className="btn btn--accent btn--lg">Pelajari CMS Mitra →</a>
              <a href={STORE_LINKS.whatsapp} className="btn btn--outline-light btn--lg" target="_blank" rel="noopener noreferrer">
                Konsultasi via WhatsApp
              </a>
            </div>
          </div>
          <div className="b2b__panel" aria-label="Pratinjau dashboard okupansi venue (ilustrasi)">
            <strong style={{ color: '#fff' }}>Ringkasan Okupansi</strong>
            <p style={{ fontSize: '0.85rem' }}>{B2B_DASHBOARD.venue}</p>
            <div className="b2b__chart" aria-hidden="true">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <small>Grafik reservasi slot</small>
                <small style={{ color: '#15803d' }}>{B2B_DASHBOARD.avgFill}</small>
              </div>
              <svg viewBox="0 0 300 80" style={{ width: '100%', height: 96, color: '#15803d' }} fill="none" role="presentation">
                <path d="M0 60 C 40 50, 70 20, 110 30 C 150 40, 180 10, 220 15 C 260 20, 280 5, 300 10" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
                <path d="M0 60 C 40 50, 70 20, 110 30 C 150 40, 180 10, 220 15 C 260 20, 280 5, 300 10 L 300 80 L 0 80 Z" fill="currentColor" fillOpacity="0.1" stroke="none" />
                <circle cx="220" cy="15" fill="#00652c" r="4" stroke="none" />
              </svg>
            </div>
            <div className="b2b__stats">
              <div className="b2b__stat"><span>Pemasukan hari ini</span><b>{B2B_DASHBOARD.revenueToday}</b></div>
              <div className="b2b__stat"><span>Sparing terlaksana</span><b>{B2B_DASHBOARD.matchesDone}</b></div>
              <div className="b2b__stat"><span>Pertumbuhan</span><b>{B2B_DASHBOARD.growth}</b></div>
            </div>
            <span className="placeholder-tag">TODO-WEB: metrik dashboard ilustrasi — via B2B_DASHBOARD di content.ts</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  return (
    <section className="section section--alt" id="faq" aria-labelledby="faq-title">
      <div className="container">
        <header className="section-header reveal">
          <span className="eyebrow">Pertanyaan populer</span>
          <h2 id="faq-title">Ada pertanyaan seputar KawanSport?</h2>
          <p className="section-header__desc">Semua yang perlu kamu tahu soal matchmaking, reservasi, dan keamanan dana.</p>
        </header>
        <div className="faq reveal">
          {FAQS.map((f, i) => {
            const open = openIndex === i;
            return (
              <div className="faq__item" key={f.q}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>
                  <button
                    className="faq__btn"
                    aria-expanded={open}
                    aria-controls={`faq-panel-${i}`}
                    id={`faq-button-${i}`}
                    onClick={() => setOpenIndex(open ? null : i)}
                  >
                    <span>{f.q}</span>
                    <span className="faq__icon" aria-hidden="true">+</span>
                  </button>
                </h3>
                {open && (
                  <div className="faq__panel" id={`faq-panel-${i}`} role="region" aria-labelledby={`faq-button-${i}`}>
                    <p>{f.a}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
