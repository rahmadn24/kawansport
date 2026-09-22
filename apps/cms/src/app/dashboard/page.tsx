'use client';

import Link from 'next/link';
import { clearSession, useAuth } from '@/lib/auth';
import { RoleBadge } from '@/components/ui';

/** Dashboard umum: skeleton + tautan per role (guard: login saja). */
export default function DashboardPage() {
  const { me, loading, error, logout } = useAuth();
  if (loading) return <main className="ks-login-wrap"><div className="ks-login-card"><p className="ks-muted-text">Memuat sesi…</p></div></main>;
  if (error || !me) {
    return (
      <main className="ks-login-wrap">
        <div className="ks-login-card">
          <p>{error ?? 'Profil tidak ditemukan.'}</p>
          <button className="ks-btn ks-btn-primary" onClick={() => { clearSession(); window.location.href = '/'; }}>Ke login</button>
        </div>
      </main>
    );
  }
  return (
    <div className="ks-shell">
      <aside className="ks-sidebar">
        <div className="ks-brand">
          <div className="ks-brand-mark">KS</div>
          <div>
            <div className="ks-brand-name">KawanSport</div>
            <div className="ks-brand-sub">CMS</div>
          </div>
        </div>
        <div className="ks-nav-label">Area</div>
        <Link className="ks-nav-link" href="/dashboard/admin">📊 Admin — moderasi & data</Link>
        <Link className="ks-nav-link" href="/dashboard/owner">🏟️ Venue owner — venue saya</Link>
        <Link className="ks-nav-link" href="/dashboard/seller">🛍️ Seller — produk saya</Link>
      </aside>
      <div className="ks-main">
        <header className="ks-topbar">
          <span className="email">{me.email}</span>
          <RoleBadge role={me.role} />
          <span className="spacer" />
          <button className="ks-btn ks-btn-ghost ks-btn-sm" onClick={logout}>Keluar</button>
        </header>
        <main className="ks-content">
          <h1 className="ks-page-title">Dashboard</h1>
          <p className="ks-page-sub">
            Selamat datang, <strong>{me.displayName ?? me.email}</strong>. Pilih area kerja di bawah.
          </p>
          <div className="ks-grid ks-grid-2">
            <Link className="ks-card ks-card-link" href="/dashboard/admin">
              <p className="label">Moderasi & data</p>
              <h2 className="ks-panel-title">Admin</h2>
              <span className="go">Buka admin →</span>
            </Link>
            <Link className="ks-card ks-card-link" href="/dashboard/owner">
              <p className="label">Venue & booking</p>
              <h2 className="ks-panel-title">Venue owner</h2>
              <span className="go">Buka area owner →</span>
            </Link>
            <Link className="ks-card ks-card-link" href="/dashboard/seller">
              <p className="label">Produk & pesanan</p>
              <h2 className="ks-panel-title">Seller</h2>
              <span className="go">Buka area seller →</span>
            </Link>
          </div>
          {me.role === 'user' && (
            <div className="ks-card" style={{ marginTop: 16 }}>
              <p className="ks-muted-text">
                Akun <code>user</code> tidak punya area khusus — halaman per role di atas akan menampilkan 403.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
