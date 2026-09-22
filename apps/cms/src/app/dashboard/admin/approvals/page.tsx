'use client';

import { useCallback, useEffect, useState } from 'react';
import { RoleGuard } from '@/components/RoleGuard';
import { ADMIN_NAV, Shell } from '@/components/Shell';
import { EmptyState, StatusBadge } from '@/components/ui';
import { apiFetch, disp, type AdminListResponse, type AdminRow } from '@/lib/api';
import { getAccessToken, useAuth } from '@/lib/auth';

type Tab = 'venues' | 'sellers' | 'products' | 'changes';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'venues', label: '🏟️ Venue' },
  { id: 'sellers', label: '🛍️ Seller' },
  { id: 'products', label: '📦 Produk' },
  { id: 'changes', label: '📝 Change requests' },
];

const STATUS_OPTIONS: Record<Tab, string[]> = {
  venues: ['pending', 'approved', 'rejected', 'draft'],
  sellers: ['pending', 'approved', 'rejected'],
  products: ['pending', 'approved', 'rejected', 'draft'],
  changes: ['pending', 'approved', 'rejected'],
};

/** Halaman Approvals CMS (AD-02, khusus super_admin). */
export default function ApprovalsPage() {
  return (
    <RoleGuard allowed={['super_admin']}>
      <ApprovalsContent />
    </RoleGuard>
  );
}

function ApprovalsContent() {
  const { me, logout } = useAuth();
  const [tab, setTab] = useState<Tab>('venues');
  const [status, setStatus] = useState('pending');
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const listPath = useCallback((): string => {
    if (tab === 'venues') return `/admin/venues?status=${status}`;
    if (tab === 'sellers') return `/admin/sellers?status=${status}`;
    if (tab === 'products') return `/admin/products?status=${status}`;
    return `/admin/change-requests?status=${status}`;
  }, [tab, status]);

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
      const data = Array.isArray(res) ? res : (res.data ?? []);
      setRows(data);
      setTotal(Array.isArray(res) ? res.length : (res.meta?.total ?? data.length));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal memuat antrean');
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [listPath]);

  useEffect(() => {
    setStatus('pending');
  }, [tab]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function act(id: string, kind: 'approve' | 'reject') {
    const token = getAccessToken();
    if (!token) return;
    const label = summary(tab, rows.find((r) => String(r.id) === id) ?? { id });
    if (!window.confirm(
      kind === 'approve'
        ? `Setujui pengajuan ini?\n${label}`
        : `Tolak pengajuan ini?\n${label}`,
    )) return;
    setBusyId(id);
    setError(null);
    try {
      const reason = (reasons[id] ?? '').trim();
      if (tab === 'venues') {
        if (kind === 'approve') {
          await apiFetch(`/venues/${id}/approve`, token, { method: 'POST' });
        } else {
          await apiFetch(`/venues/${id}/reject`, token, {
            method: 'POST',
            body: { reason: reason || undefined },
          });
        }
      } else if (tab === 'sellers') {
        if (kind === 'approve') {
          await apiFetch(`/sellers/${id}/approve`, token, { method: 'POST' });
        } else {
          await apiFetch(`/sellers/${id}/reject`, token, {
            method: 'POST',
            body: { reason: reason || undefined },
          });
        }
      } else if (tab === 'products') {
        if (kind === 'approve') {
          await apiFetch(`/products/${id}/approve`, token, { method: 'POST' });
        } else {
          await apiFetch(`/products/${id}/reject`, token, {
            method: 'POST',
            body: { reason: reason || undefined },
          });
        }
      } else {
        if (kind === 'approve') {
          await apiFetch(`/admin/change-requests/${id}/approve`, token, {
            method: 'POST',
          });
        } else {
          await apiFetch(`/admin/change-requests/${id}/reject`, token, {
            method: 'POST',
            body: { reason: reason || undefined },
          });
        }
      }
      setReasons((r) => ({ ...r, [id]: '' }));
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Aksi gagal');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Shell
      me={me}
      onLogout={logout}
      nav={ADMIN_NAV}
      title="Approvals"
      subtitle="Tinjau pengajuan venue, seller, produk, dan change-request. Tindakan hanya aktif untuk status pending."
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
        <label>
          Status:{' '}
          <select className="ks-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTIONS[tab].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <button className="ks-btn ks-btn-ghost ks-btn-sm" onClick={() => void refresh()} disabled={loading}>
          {loading ? 'Memuat…' : '🔄 Muat ulang'}
        </button>
        <span className="ks-total">Total: {total}</span>
      </section>
      {error && <p className="ks-error" role="alert">⚠️ Error: {error}</p>}
      {rows.length === 0 && !loading && (
        <EmptyState
          icon="✅"
          title="Antrean kosong"
          desc={`Tidak ada pengajuan berstatus "${status}" pada tab ini. Coba ubah filter status atau muat ulang.`}
          action={<button className="ks-btn ks-btn-ghost ks-btn-sm" onClick={() => void refresh()}>Muat ulang</button>}
        />
      )}
      {rows.length > 0 && (
        <div className="ks-table-wrap">
          <table className="ks-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Ringkasan</th>
                <th>Status</th>
                <th>Alasan reject</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const id = String(row.id ?? '');
                const isPending = row.status === 'pending';
                return (
                  <tr key={id}>
                    <td className="ks-id">{id.slice(0, 8)}…</td>
                    <td>{summary(tab, row)}</td>
                    <td><StatusBadge status={row.status} /></td>
                    <td>
                      <input
                        className="ks-input"
                        style={{ width: 190 }}
                        placeholder="Alasan (opsional)"
                        value={reasons[id] ?? ''}
                        onChange={(e) =>
                          setReasons((r) => ({ ...r, [id]: e.target.value }))
                        }
                      />
                      {row.rejectionReason != null && (
                        <div className="ks-history">Riwayat: {disp(row.rejectionReason)}</div>
                      )}
                      {row.reason != null && <div className="ks-history">Riwayat: {disp(row.reason)}</div>}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button
                        className="ks-btn ks-btn-primary ks-btn-sm"
                        onClick={() => void act(id, 'approve')}
                        disabled={busyId === id || !isPending}
                        title={isPending ? 'Setujui pengajuan' : 'Hanya status pending yang bisa diproses'}
                      >
                        ✓ Approve
                      </button>{' '}
                      <button
                        className="ks-btn ks-btn-danger ks-btn-sm"
                        onClick={() => void act(id, 'reject')}
                        disabled={busyId === id || !isPending}
                        title={isPending ? 'Tolak pengajuan' : 'Hanya status pending yang bisa diproses'}
                      >
                        ✕ Reject
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}

/** Ringkasan satu baris per tipe antrean. */
function summary(tab: Tab, row: AdminRow): string {
  if (tab === 'venues') {
    const owner = row.owner as AdminRow | undefined;
    return `${disp(row.name)} — owner ${disp(owner?.email)}`;
  }
  if (tab === 'sellers') {
    const owner = row.owner as AdminRow | undefined;
    return `${disp(row.shopName)} — owner ${disp(owner?.email)}`;
  }
  if (tab === 'products') {
    const seller = row.seller as AdminRow | undefined;
    return `${disp(row.name)} — Rp${disp(row.price)} — seller ${disp(seller?.shopName)}`;
  }
  return `${disp(row.entityType)} ${disp(row.entityId)} → ${disp(row.payload)} (oleh ${disp(row.requestedBy)})`;
}
