'use client';

import { useEffect, useState } from 'react';
import { RoleGuard } from '@/components/RoleGuard';
import { ADMIN_NAV, Shell } from '@/components/Shell';
import { apiUrl } from '@/lib/api';
import { getAccessToken, useAuth } from '@/lib/auth';

/** Dashboard super_admin + bukti guard server (GET /admin/ping). */
export default function AdminDashboard() {
  return (
    <RoleGuard allowed={['super_admin']}>
      <AdminContent />
    </RoleGuard>
  );
}

function AdminContent() {
  const { me, logout } = useAuth();
  const [pingOk, setPingOk] = useState<boolean | null>(null);
  const [pingRole, setPingRole] = useState<string | null>(null);
  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    fetch(`${apiUrl()}/admin/ping`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => {
        if (!r.ok) {
          setPingOk(false);
          return;
        }
        const body = (await r.json()) as { ok?: boolean; role?: string };
        setPingOk(body.ok === true);
        setPingRole(typeof body.role === 'string' ? body.role : null);
      })
      .catch(() => setPingOk(false));
  }, []);
  return (
    <Shell
      me={me}
      onLogout={logout}
      nav={ADMIN_NAV}
      title="Dashboard Admin"
      subtitle={`Halo, ${me?.displayName ?? me?.email ?? ''} — kelola persetujuan, data, dan statistik dari sini.`}
    >
      <div className="ks-grid ks-grid-2">
        <div className="ks-card">
          <p className="label">Guard server</p>
          <h2 className="ks-panel-title">Status API</h2>
          <p><span className="ks-code">GET /admin/ping</span> →{' '}
            {pingOk === null ? (
              <span className="ks-muted-text">memeriksa…</span>
            ) : pingOk ? (
              <span className="ks-badge approved">● Terhubung{pingRole ? ` (${pingRole})` : ''}</span>
            ) : (
              <span className="ks-badge rejected">● Terputus — cek API :3000</span>
            )}
          </p>
        </div>
        <div className="ks-card">
          <p className="label">Antrean moderasi</p>
          <h2 className="ks-panel-title">Approvals</h2>
          <p className="ks-muted-text">Setujui atau tolak venue, seller, produk, dan change-request.</p>
          <a className="ks-btn ks-btn-primary ks-btn-sm" href="/dashboard/admin/approvals">Buka approvals</a>
        </div>
        <div className="ks-card">
          <p className="label">Jelajah data</p>
          <h2 className="ks-panel-title">Data (read-only)</h2>
          <p className="ks-muted-text">Lihat users, venues, events, produk, bookings, dan orders + filter status.</p>
          <a className="ks-btn ks-btn-primary ks-btn-sm" href="/dashboard/admin/lists">Buka data</a>
        </div>
        <div className="ks-card">
          <p className="label">Kinerja platform</p>
          <h2 className="ks-panel-title">Statistik</h2>
          <p className="ks-muted-text">Pantau users, venues, bookings, orders, GMV, dan olahraga teratas.</p>
          <a className="ks-btn ks-btn-primary ks-btn-sm" href="/dashboard/admin/stats">Buka statistik</a>
        </div>
      </div>
    </Shell>
  );
}
