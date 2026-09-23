'use client';

import { useEffect, useState } from 'react';
import { BRAND, NAV_LINKS, STORE_LINKS } from '@/lib/content';

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`site-header${scrolled || open ? ' site-header--scrolled' : ''}`} role="banner">
      <nav className="container site-nav" aria-label="Navigasi utama">
        <a href="#beranda" className="brand" aria-label={`${BRAND.name} — Beranda`}>
          <span className="brand__mark" aria-hidden="true">⚡</span>
          <span>{BRAND.name}</span>
        </a>
        <div className="nav-links">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </div>
        <div className="nav-cta">
          <a href={STORE_LINKS.webLogin} className="btn btn--ghost btn--sm">
            Masuk
          </a>
          <a href="#download" className="btn btn--accent btn--sm">
            Unduh
          </a>
        </div>
        <button
          className="mobile-toggle"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'Tutup menu' : 'Buka menu'}
        >
          {open ? '✕' : '☰'}
        </button>
      </nav>
      {open && (
        <div id="mobile-menu" className="mobile-menu">
          <div className="container">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)}>
                {l.label}
              </a>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
              <a href={STORE_LINKS.webLogin} className="btn btn--ghost btn--sm">
                Masuk
              </a>
              <a href="#download" className="btn btn--accent btn--sm" onClick={() => setOpen(false)}>
                Unduh
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
