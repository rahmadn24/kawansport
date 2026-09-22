'use client';

import Link from 'next/link';
import { RoleGuard } from '@/components/RoleGuard';
import { EmptyState, RoleBadge } from '@/components/ui';
import { useAuth } from '@/lib/auth';

/** Skeleton dashboard seller (scope marketplace/MP fase berikut). */
export default function SellerDashboard() {
  return (
    <RoleGuard allowed={['seller']}>
      <SellerContent />
    </RoleGuard>
  );
}

function SellerContent() {
  const { me, logout } = useAuth();
  return (
    <div className="ks-shell">
      <aside className="ks-sidebar">
        <div className="ks-brand">
          <div className="ks-brand-mark">KS</div>
          <div>
            <div className="ks-brand-name">KawanSport</div>
            <div className="ks-brand-sub">CMS Seller</div>
          </div>
        </div>
        <div className="ks-nav-label">Menu</div>
        <Link className="ks-nav-link active" href="/dashboard/seller">🛍️ Produk saya</Link>
      </aside>
      <div className="ks-main">
        <header className="ks-topbar">
          <span className="email">{me?.email}</span>
          {me && <RoleBadge role={me.role} />}
          <span className="spacer" />
          <button className="ks-btn ks-btn-ghost ks-btn-sm" onClick={logout}>Keluar</button>
        </header>
        <main className="ks-content">
          <h1 className="ks-page-title">Seller</h1>
          <p className="ks-page-sub">Halo, {me?.displayName ?? me?.email} — area produk & pesanan Anda.</p>
          <EmptyState
            icon="🛍️"
            title="Segera hadir"
            desc="Daftar produk dan pesanan akan tampil di sini pada fase berikutnya. Saat ini belum ada fitur yang perlu ditindaklanjuti."
            action={<Link className="ks-btn ks-btn-ghost ks-btn-sm" href="/dashboard">← Kembali ke dashboard</Link>}
          />
        </main>
      </div>
    </div>
  );
}
