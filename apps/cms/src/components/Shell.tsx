'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { MeResponse } from '@/lib/api';
import { RoleBadge } from '@/components/ui';

export interface NavItem {
  href: string;
  label: string;
}

export const ADMIN_NAV: NavItem[] = [
  { href: '/dashboard/admin', label: '📊 Dashboard' },
  { href: '/dashboard/admin/approvals', label: '✅ Approvals' },
  { href: '/dashboard/admin/lists', label: '🗂️ Data' },
  { href: '/dashboard/admin/stats', label: '📈 Statistik' },
];

/** Kerangka konsisten: sidebar navigasi + topbar (email, role badge, Keluar). */
export function Shell({
  me,
  onLogout,
  nav,
  title,
  subtitle,
  children,
}: {
  me?: MeResponse | null;
  onLogout: () => void;
  nav: NavItem[];
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div className="ks-shell">
      <aside className="ks-sidebar">
        <div className="ks-brand">
          <div className="ks-brand-mark">KS</div>
          <div>
            <div className="ks-brand-name">KawanSport</div>
            <div className="ks-brand-sub">CMS Admin</div>
          </div>
        </div>
        <div className="ks-nav-label">Menu</div>
        {nav.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`ks-nav-link${pathname === n.href ? ' active' : ''}`}
          >
            {n.label}
          </Link>
        ))}
      </aside>
      <div className="ks-main">
        <header className="ks-topbar">
          <span className="email">{me?.email ?? '…'}</span>
          {me && <RoleBadge role={me.role} />}
          <span className="spacer" />
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
    </div>
  );
}
