'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { RoleGuard } from '@/components/RoleGuard';
import { ADMIN_NAV, Shell } from '@/components/Shell';
import { EmptyState, RoleBadge, StatusBadge, formatIDR } from '@/components/ui';
import { apiFetch, disp, type AdminListResponse, type AdminRow } from '@/lib/api';
import { getAccessToken, useAuth } from '@/lib/auth';

type Tab = 'users' | 'venues' | 'events' | 'products' | 'bookings' | 'orders';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'users', label: '👥 Users' },
  { id: 'venues', label: '🏟️ Venues' },
  { id: 'events', label: '📅 Events' },
  { id: 'products', label: '📦 Products' },
  { id: 'bookings', label: '🎟️ Bookings' },
  { id: 'orders', label: '🧾 Orders' },
];

const STATUS_OPTIONS: Partial<Record<Tab, string[]>> = {
  venues: ['', 'draft', 'pending', 'approved', 'rejected'],
  products: ['', 'draft', 'pending', 'approved', 'rejected'],
  bookings: ['', 'pending', 'paid', 'expired', 'cancelled'],
  orders: ['', 'pending', 'paid', 'expired', 'cancelled'],
  events: ['', 'open', 'full'],
};

const ROLE_OPTIONS = ['', 'super_admin', 'venue_owner', 'seller', 'user'];

/** Halaman list read-only CMS (AD-02, khusus super_admin) + filter status. */
export default function AdminListsPage() {
  return (
    <RoleGuard allowed={['super_admin']}>
      <ListsContent />
    </RoleGuard>
  );
}

function ListsContent() {
  const { me, logout } = useAuth();
  const [tab, setTab] = useState<Tab>('users');
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listPath = useCallback((): string => {
    if (tab === 'users') {
      const q = new URLSearchParams();
      if (filter) q.set('role', filter);
      if (search.trim()) q.set('search', search.trim());
      const qs = q.toString();
      return `/admin/users${qs ? `?${qs}` : ''}`;
    }
    if (tab === 'venues') {
      return filter ? `/admin/venues?status=${filter}` : '/admin/venues';
    }
    if (tab === 'events') return '/events?limit=50';
    if (tab === 'products') {
      return filter ? `/admin/products?status=${filter}` : '/admin/products';
    }
    if (tab === 'bookings') {
      return filter ? `/admin/bookings?status=${filter}` : '/admin/bookings';
    }
    return filter ? `/admin/orders?status=${filter}` : '/admin/orders';
  }, [tab, filter, search]);

  const refresh = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<AdminListResponse | AdminRow[]>(
        listPath(),
        token,
      );
      let data: AdminRow[] = Array.isArray(res) ? res : (res.data ?? []);
      const totalCount = Array.isArray(res)
        ? res.length
        : (res.meta?.total ?? data.length);
      if (tab === 'events' && filter) {
        data = data.filter((r) => String(r.status ?? '') === filter);
      }
      setRows(data);
      setTotal(totalCount);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal memuat daftar');
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [listPath, tab, filter]);

  useEffect(() => {
    setFilter('');
    setSearch('');
  }, [tab]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const cols = columnsFor(tab);

  return (
    <Shell
      me={me}
      onLogout={logout}
      nav={ADMIN_NAV}
      title="Data"
      subtitle="Jelajahi data platform dalam mode read-only. Gunakan filter status/role untuk mempersempit hasil."
    >
      <div className="ks-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`ks-tab${tab === t.id ? ' active' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <section className="ks-toolbar">
        {tab === 'users' ? (
          <>
            <label>
              Role:{' '}
              <select className="ks-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r === '' ? '(semua)' : r}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Cari:{' '}
              <input
                className="ks-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="email / nama"
              />
            </label>
          </>
        ) : (
          STATUS_OPTIONS[tab] && (
            <label>
              Status:{' '}
              <select className="ks-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
                {STATUS_OPTIONS[tab]?.map((s) => (
                  <option key={s} value={s}>
                    {s === '' ? '(semua)' : s}
                  </option>
                ))}
              </select>
            </label>
          )
        )}
        <button className="ks-btn ks-btn-ghost ks-btn-sm" onClick={() => void refresh()} disabled={loading}>
          {loading ? 'Memuat…' : '🔄 Muat ulang'}
        </button>
        <span className="ks-total">Total: {total}</span>
      </section>
      {error && <p className="ks-error" role="alert">⚠️ Error: {error}</p>}
      {rows.length === 0 && !loading && (
        <EmptyState
          icon="🗂️"
          title="Tidak ada data"
          desc="Belum ada baris yang cocok dengan filter saat ini. Coba longgarkan filter atau muat ulang."
          action={<button className="ks-btn ks-btn-ghost ks-btn-sm" onClick={() => void refresh()}>Muat ulang</button>}
        />
      )}
      {rows.length > 0 && (
        <div className="ks-table-wrap">
          <table className="ks-table">
            <thead>
              <tr>
                {cols.map((c) => (
                  <th key={c}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={String(row.id ?? i)}>
                  {cols.map((c) => (
                    <td key={c}>
                      {cell(tab, c, row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}

function columnsFor(tab: Tab): string[] {
  switch (tab) {
    case 'users':
      return ['id', 'email', 'displayName', 'role', 'createdAt'];
    case 'venues':
      return ['id', 'name', 'status', 'owner', 'updatedBy', 'createdAt'];
    case 'events':
      return ['id', 'title', 'sport', 'status', 'datetime'];
    case 'products':
      return ['id', 'name', 'price', 'stock', 'status', 'seller', 'updatedBy'];
    case 'bookings':
      return ['id', 'status', 'userId', 'courtId', 'date', 'amount'];
    case 'orders':
      return ['id', 'status', 'total', 'createdAt'];
    default:
      return ['id', 'status'];
  }
}

function cell(tab: Tab, col: string, row: AdminRow): ReactNode {
  if (col === 'id') return <span className="ks-id">{String(row.id ?? '—').slice(0, 8)}…</span>;
  if (col === 'status') return <StatusBadge status={row.status} />;
  if (col === 'role') return <RoleBadge role={row.role} />;
  if (col === 'owner' && tab === 'venues') {
    const owner = row.owner as AdminRow | undefined;
    return disp(owner?.email);
  }
  if (col === 'seller' && tab === 'products') {
    const seller = row.seller as AdminRow | undefined;
    return disp(seller?.shopName);
  }
  if ((col === 'price' || col === 'amount' || col === 'total') && typeof row[col] === 'number') {
    return formatIDR(row[col] as number);
  }
  return disp(row[col]);
}
