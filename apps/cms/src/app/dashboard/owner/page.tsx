'use client';

import Link from 'next/link';
import { RoleGuard } from '@/components/RoleGuard';
import { EmptyState, RoleBadge } from '@/components/ui';
import { useAuth } from '@/lib/auth';

/** Skeleton dashboard venue_owner (scope booking/BK fase berikut). */
export default function OwnerDashboard() {
  return (
    <RoleGuard allowed={['venue_owner']}>
      <OwnerContent />
    </RoleGuard>
  );
}

function OwnerContent() {
  const { me, logout } = useAuth();
  return (
    <div className="ks-shell">
      <aside className="ks-sidebar">
        <div className="ks-brand">
          <div className="ks-brand-mark">KS</div>
          <div>
            <div className="ks-brand-name">KawanSport</div>
            <div className="ks-brand-sub">CMS Owner</div>
          </div>
        </div>
        <div className="ks-nav-label">Menu</div>
        <Link className="ks-nav-link active" href="/dashboard/owner">🏟️ Venue saya</Link>
        <Link className="ks-nav-link" href="/dashboard/owner/venues">🛠️ Kelola venue (manager)</Link>
      </aside>
      <div className="ks-main">
        <header className="ks-topbar">
          <span className="email">{me?.email}</span>
          {me && <RoleBadge role={me.role} />}
          <span className="spacer" />
          <button className="ks-btn ks-btn-ghost ks-btn-sm" onClick={logout}>Keluar</button>
        </header>
        <main className="ks-content">
          <h1 className="ks-page-title">Venue owner</h1>
          <p className="ks-page-sub">Halo, {me?.displayName ?? me?.email} — area venue & booking Anda.</p>
          <EmptyState
            icon="🏟️"
            title="Segera hadir"
            desc="Daftar venue dan status booking akan tampil di sini pada fase berikutnya. Saat ini belum ada fitur yang perlu ditindaklanjuti."
            action={<Link className="ks-btn ks-btn-ghost ks-btn-sm" href="/dashboard/owner/venues">🛠️ Buka venue manager →</Link>}
          />
        </main>
      </div>
    </div>
  );
}
