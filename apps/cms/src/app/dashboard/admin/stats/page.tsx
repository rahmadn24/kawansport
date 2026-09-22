'use client';

import { useEffect, useState } from 'react';
import { RoleGuard } from '@/components/RoleGuard';
import { ADMIN_NAV, Shell } from '@/components/Shell';
import { EmptyState, formatIDR } from '@/components/ui';
import { apiFetch } from '@/lib/api';
import { getAccessToken, useAuth } from '@/lib/auth';
import {
  CartesianGrid, Cell, Legend, Pie, PieChart, Bar, BarChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

interface StatsData {
  range: { from: string; to: string };
  users: { total: number; active7d: number; active30d: number; byRole: Record<string, number> };
  venues: { total: number; approved: number; pending: number; rejected: number };
  bookings: { total: number; paid: number; pending: number; expired: number; cancelled: number; gmv: number };
  orders: { total: number; paid: number; pending: number; expired: number; cancelled: number; gmv: number };
  topSports: { sport: string; count: number }[];
}

export default function AdminStatsPage() {
  return (
    <RoleGuard allowed={['super_admin']}>
      <StatsContent />
    </RoleGuard>
  );
}

function StatsContent() {
  const { me, logout } = useAuth();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const token = getAccessToken();
      if (!token) throw new Error('Tidak ada token akses');
      const data = await apiFetch<StatsData>(`/admin/stats?${params.toString()}`, token);
      setStats(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal memuat statistik');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchStats(); }, [from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  const COLORS = ['#15803d', '#2563eb', '#f59e0b', '#dc2626', '#7c3aed', '#0d9488', '#db2777'];

  return (
    <Shell
      me={me}
      onLogout={logout}
      nav={ADMIN_NAV}
      title="Statistik"
      subtitle="Ringkasan kinerja platform KawanSport pada rentang tanggal yang dipilih."
    >
      <div className="ks-filter-row">
        <input type="date" aria-label="Dari tanggal" value={from} onChange={e => setFrom(e.target.value)} className="ks-date" />
        <input type="date" aria-label="Sampai tanggal" value={to} onChange={e => setTo(e.target.value)} className="ks-date" />
        <button onClick={fetchStats} disabled={loading} className="ks-btn ks-btn-primary ks-btn-sm">
          {loading ? 'Memuat…' : 'Terapkan filter'}
        </button>
      </div>

      {loading && !stats && <p className="ks-muted-text">Memuat statistik…</p>}
      {error && <p className="ks-error" role="alert">⚠️ {error}</p>}
      {!loading && !error && !stats && (
        <EmptyState
          icon="📈"
          title="Belum ada statistik"
          desc="Data statistik belum tersedia untuk rentang ini. Coba ubah tanggal atau muat ulang."
          action={<button className="ks-btn ks-btn-ghost ks-btn-sm" onClick={fetchStats}>Muat ulang</button>}
        />
      )}

      {stats && (
        <>
          <div className="ks-grid ks-grid-4">
            <div className="ks-card">
              <p className="label">👥 Total pengguna</p>
              <p className="value">{stats.users.total}</p>
              <p className="ks-muted-text" style={{ fontSize: 12, margin: '4px 0 0' }}>
                Aktif 7 hari: {stats.users.active7d} · 30 hari: {stats.users.active30d}
              </p>
            </div>
            <div className="ks-card">
              <p className="label">🏟️ Venue disetujui</p>
              <p className="value sm" style={{ color: 'var(--ks-primary)' }}>{stats.venues.approved} / {stats.venues.total}</p>
              <p className="ks-muted-text" style={{ fontSize: 12, margin: '4px 0 0' }}>
                Pending {stats.venues.pending} · Ditolak {stats.venues.rejected}
              </p>
            </div>
            <div className="ks-card">
              <p className="label">🎟️ Booking lunas</p>
              <p className="value sm">{stats.bookings.paid} / {stats.bookings.total}</p>
              <p className="ks-muted-text" style={{ fontSize: 12, margin: '4px 0 0' }}>
                GMV {formatIDR(stats.bookings.gmv)}
              </p>
            </div>
            <div className="ks-card" style={{ borderColor: 'var(--ks-primary)', background: 'linear-gradient(180deg,#f0fdf4,#fff)' }}>
              <p className="label">💰 GMV total</p>
              <p className="value sm">{formatIDR(stats.bookings.gmv + stats.orders.gmv)}</p>
              <p className="ks-muted-text" style={{ fontSize: 12, margin: '4px 0 0' }}>
                Booking + orders · {stats.range.from || '…'} → {stats.range.to || '…'}
              </p>
            </div>
          </div>

          <div className="ks-grid ks-grid-2" style={{ marginTop: 16 }}>
            <div className="ks-chart-box">
              <h3 className="ks-panel-title">Status booking</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={trendOf(stats.bookings)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip formatter={(v) => [v, 'Jumlah']} />
                  <Legend />
                  <Bar dataKey="value" fill="#15803d" radius={[6, 6, 0, 0]} name="Booking" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="ks-chart-box">
              <h3 className="ks-panel-title">Status order</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={trendOf(stats.orders)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip formatter={(v) => [v, 'Jumlah']} />
                  <Legend />
                  <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} name="Order" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="ks-grid ks-grid-2" style={{ marginTop: 16 }}>
            <div className="ks-chart-box">
              <h3 className="ks-panel-title">Top 5 olahraga</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={stats.topSports.map((s, i) => ({ ...s, color: COLORS[i % COLORS.length] }))}
                    cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                    dataKey="count" nameKey="sport" label={{ fontSize: 12 }}
                  >
                    {stats.topSports.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="ks-chart-box">
              <h3 className="ks-panel-title">Pengguna per role</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={Object.entries(stats.users.byRole).map(([role, count]) => ({ role, count }))}
                    cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                    dataKey="count" nameKey="role" label={{ fontSize: 12 }}
                  >
                    {Object.entries(stats.users.byRole).map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </Shell>
  );
}

function trendOf(s: { paid: number; pending: number; expired: number; cancelled: number }) {
  return [
    { name: 'Lunas', value: s.paid },
    { name: 'Pending', value: s.pending },
    { name: 'Kedaluwarsa', value: s.expired },
    { name: 'Batal', value: s.cancelled },
  ];
}
