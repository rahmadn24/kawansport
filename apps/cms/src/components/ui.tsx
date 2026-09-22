'use client';

import type { ReactNode } from 'react';
import { disp } from '@/lib/api';

/** Badge status berwarna (pending/approved/rejected/paid/expired/cancelled/draft/open/full). */
export function StatusBadge({ status }: { status: unknown }) {
  const s = String(status ?? '—');
  const known = ['pending', 'approved', 'rejected', 'paid', 'expired', 'cancelled', 'draft', 'open', 'full'];
  const cls = known.includes(s) ? s : 'unknown';
  return <span className={`ks-badge ${cls}`}>{s}</span>;
}

/** Badge role pengguna. */
export function RoleBadge({ role }: { role: unknown }) {
  const r = String(role ?? '—');
  return <span className={`ks-badge ks-role ${r}`}>{disp(role)}</span>;
}

/** Empty state generik: ikon + judul + deskripsi + aksi. */
export function EmptyState({
  icon = '📭',
  title,
  desc,
  action,
}: {
  icon?: string;
  title: string;
  desc: string;
  action?: ReactNode;
}) {
  return (
    <div className="ks-empty">
      <div className="icon" aria-hidden>{icon}</div>
      <h2>{title}</h2>
      <p>{desc}</p>
      {action}
    </div>
  );
}

/** Format IDR konsisten id-ID tanpa desimal. */
export function formatIDR(n: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(n);
}
