'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import type { MeResponse } from '@/lib/api';
import { RoleBadge } from '@/components/ui';

export interface NavItem {
  href: string;
  label: string;
  /** Ikon dekoratif (emoji/glif). */
  icon?: string;
  /** True bila halaman belum ada — tampil badge "Segera", klik memicu toast (bukan 404). */
  soon?: boolean;
}

/** NAVIGASI UTAMA — Stitch CMS Control Center. */
export const ADMIN_MAIN_NAV: NavItem[] = [
  { href: '/dashboard/admin', label: 'Dashboard Overview', icon: '▦' },
  { href: '/dashboard/admin/approvals', label: 'Manajemen Venue & Approval', icon: '🏟' },
  { href: '/dashboard/admin/lists', label: 'Pengguna & Komunitas', icon: '👥' },
  { href: '/dashboard/admin/stats', label: 'Transaksi & Keuangan', icon: '💳' },
  { href: '/dashboard/admin/promos', label: 'Banner Promo', icon: '🎟' },
  // TODO: halaman belum ada — badge "Segera", jangan buat rute diam-diam 404.
  { href: '#fee-voucher', label: 'Fee Platform & Voucher', icon: '🎟', soon: true },
  { href: '#pengaturan', label: 'Pengaturan Sistem', icon: '⚙', soon: true },
];

/** MITRA PENGELOLA — Stitch CMS Control Center. */
export const ADMIN_PARTNER_NAV: NavItem[] = [
  // /dashboard/owner riil (RoleGuard owner meloloskan super_admin).
  { href: '/dashboard/owner', label: 'Overview Lapangan', icon: '⚽' },
  // TODO: halaman mitra berikut belum ada — badge "Segera".
  { href: '#jadwal', label: 'Jadwal & Slot Kalender', icon: '📅', soon: true },
  { href: '#reservasi', label: 'Reservasi & Check-in QR', icon: '🔳', soon: true },
  { href: '#harga', label: 'Harga & Operasional', icon: '🕒', soon: true },
  { href: '#payout', label: 'Pendapatan & Payout', icon: '💰', soon: true },
  { href: '#ulasan', label: 'Ulasan Pemain', icon: '⭐', soon: true },
];

/** Gabungan untuk kompatibilitas halaman existing (approvals/lists/stats). */
export const ADMIN_NAV: NavItem[] = [...ADMIN_MAIN_NAV, ...ADMIN_PARTNER_NAV];

/**
 * NAVIGASI OWNER — venue manager CMS (WEB-03).
 * Tidak ada endpoint list-mine venue (TODO API-W05), sehingga entri
 * "/dashboard/owner/venues" meminta venueId manual.
 */
export const OWNER_NAV: NavItem[] = [
  { href: '/dashboard/owner', label: 'Overview', icon: '⚽' },
  { href: '/dashboard/owner/venues', label: 'Venue Saya', icon: '🏟' },
];

/**
 * NAVIGASI SELLER — dashboard toko CMS (MP-01/MP-02 + API-W08).
 * Grup non-admin: dirender apa adanya oleh Shell (jalur otherNav).
 */
export const SELLER_NAV: NavItem[] = [
  { href: '/dashboard/seller', label: 'Overview Toko', icon: '🛍️' },
  { href: '/dashboard/seller/products', label: 'Produk Saya', icon: '📦' },
  { href: '/dashboard/seller/orders', label: 'Pesanan', icon: '🧾' },
  { href: '/dashboard/seller/payouts', label: 'Saldo & Payout', icon: '💸' },
];

/**
 * Kerangka global CMS: sidebar Stitch (navigasi + Server Core ID) +
 * topbar (search, status gateway, bell, user+role) + drawer mobile.
 * Search topbar: fungsional bila onSearchQuery diisi (filter tabel halaman
 * aktif); bila tidak, dekoratif + TODO filter global.
 */
export function Shell({
  me,
  onLogout,
  nav,
  title,
  subtitle,
  children,
  searchQuery,
  onSearchQuery,
  searchPlaceholder = 'Cari venue, id booking, atau transaksi…',
}: {
  me?: MeResponse | null;
  onLogout: () => void;
  nav: NavItem[];
  title: string;
  subtitle?: string;
  children: ReactNode;
  searchQuery?: string;
  onSearchQuery?: (q: string) => void;
  searchPlaceholder?: string;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Tutup drawer tiap pindah halaman; toast hilang otomatis.
  useEffect(() => setDrawerOpen(false), [pathname]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const showSoon = (label: string) =>
    setToast(`“${label}” belum tersedia — segera hadir.`);
  const showBell = () =>
    // TODO API-W04: ganti dengan notifikasi riil dari endpoint aktivitas.
    setToast('Belum ada notifikasi — riwayat aktivitas menyusul (TODO API-W04).');

  const mainNav = nav.filter((n) => ADMIN_MAIN_NAV.some((m) => m.href === n.href));
  const partnerNav = nav.filter((n) => ADMIN_PARTNER_NAV.some((m) => m.href === n.href));
  // Nav kustom (owner/seller) yang tidak termasuk grup admin: tampilkan apa adanya.
  const otherNav = nav.filter((n) => !ADMIN_MAIN_NAV.some((m) => m.href === n.href)
    && !ADMIN_PARTNER_NAV.some((m) => m.href === n.href));
  const grouped = mainNav.length > 0 || partnerNav.length > 0;

  const renderLink = (n: NavItem) => {
    if (n.soon) {
      return (
        <button
          key={n.href + n.label}
          type="button"
          className="ks-nav-link ks-nav-soon"
          onClick={() => showSoon(n.label)}
          aria-label={`${n.label} — segera hadir`}
        >
          <span aria-hidden>{n.icon ?? '•'}</span>
          <span className="ks-nav-text">{n.label}</span>
          <span className="ks-segera">Segera</span>
        </button>
      );
    }
    return (
      <Link
        key={n.href}
        href={n.href}
        className={`ks-nav-link${pathname === n.href ? ' active' : ''}`}
        aria-current={pathname === n.href ? 'page' : undefined}
      >
        <span aria-hidden>{n.icon ?? '•'}</span>
        <span className="ks-nav-text">{n.label}</span>
      </Link>
    );
  };

  return (
    <div className="ks-shell">
      {drawerOpen && (
        <div
          className="ks-scrim"
          onClick={() => setDrawerOpen(false)}
          aria-hidden
        />
      )}
      <aside className={`ks-sidebar${drawerOpen ? ' open' : ''}`} aria-label="Navigasi CMS">
        <div className="ks-brand">
          <div className="ks-brand-mark" aria-hidden>KS</div>
          <div>
            <div className="ks-brand-name">KawanSport</div>
            <div className="ks-brand-sub">CMS Control Center</div>
          </div>
        </div>
        {grouped ? (
          <>
            <nav aria-label="Navigasi utama">
              <div className="ks-nav-label">Navigasi Utama</div>
              {mainNav.map(renderLink)}
            </nav>
            <nav aria-label="Mitra pengelola">
              <div className="ks-nav-label">Mitra Pengelola</div>
              {partnerNav.map(renderLink)}
            </nav>
            {otherNav.length > 0 && (
              <nav aria-label="Navigasi tambahan">
                <div className="ks-nav-label">Lainnya</div>
                {otherNav.map(renderLink)}
              </nav>
            )}
          </>
        ) : (
          <nav aria-label="Menu">
            <div className="ks-nav-label">Menu</div>
            {nav.map(renderLink)}
          </nav>
        )}
        <div className="ks-side-foot">
          <div className="ks-server-card">
            <div>
              <div className="ks-server-name">Server Core ID</div>
              <div className="ks-server-ver">v2.4.1 Active</div>
            </div>
            <span className="ks-dot" aria-hidden />
          </div>
        </div>
      </aside>

      <div className="ks-main">
        <header className="ks-topbar">
          <button
            type="button"
            className="ks-iconbtn ks-hamburger"
            onClick={() => setDrawerOpen((v) => !v)}
            aria-label={drawerOpen ? 'Tutup navigasi' : 'Buka navigasi'}
            aria-expanded={drawerOpen}
          >
            ☰
          </button>
          <div className="ks-searchwrap">
            <span aria-hidden>🔍</span>
            <input
              type="search"
              className="ks-search"
              placeholder={searchPlaceholder}
              aria-label="Pencarian"
              value={searchQuery ?? ''}
              onChange={onSearchQuery ? (e) => onSearchQuery(e.target.value) : undefined}
              readOnly={!onSearchQuery}
              // TODO: bila readOnly (halaman tanpa filter lokal), sambungkan ke pencarian global API.
              title={onSearchQuery ? undefined : 'TODO: pencarian global belum tersambung ke API'}
            />
          </div>
          <span className="spacer" />
          {/* TODO: status gateway statis — sambungkan ke endpoint health bila tersedia. */}
          <span
            className="ks-gateway"
            title="TODO: status gateway statis — sambungkan ke endpoint health bila tersedia"
          >
            <span className="ks-dot" aria-hidden /> Operasional Stabil
          </span>
          <button type="button" className="ks-iconbtn" onClick={showBell} aria-label="Notifikasi">
            🔔
          </button>
          <span className="ks-userbox">
            <span className="ks-username">{me?.displayName ?? me?.email ?? '…'}</span>
            {me && <RoleBadge role={me.role} />}
          </span>
          <button className="ks-btn ks-btn-ghost ks-btn-sm" onClick={onLogout}>
            Keluar
          </button>
        </header>
        <main className="ks-content">
          <h1 className="ks-page-title">{title}</h1>
          {subtitle && <p className="ks-page-sub">{subtitle}</p>}
          {children}
        </main>
      </div>

      {toast && (
        <div className="ks-toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  );
}
