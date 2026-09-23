'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RoleGuard } from '@/components/RoleGuard';
import { ADMIN_NAV, Shell } from '@/components/Shell';
import { EmptyState, formatIDR } from '@/components/ui';
import { apiFetch, disp, type AdminListResponse, type AdminRow } from '@/lib/api';
import { getAccessToken, useAuth } from '@/lib/auth';

// TODO API-W03: nilai fee read-only dari konstanta klien sampai endpoint
// konfigurasi fee tersedia. Jangan anggap sebagai data server.
const SERVICE_FEE_RP = 2500;
const COMMISSION_RATE = 0.05; // komisi final platform 5% dari GMV

interface StatsData {
  range: { from: string; to: string };
  users: { total: number; active7d: number; active30d: number; byRole: Record<string, number> };
  venues: { total: number; approved: number; pending: number; rejected: number };
  bookings: { total: number; paid: number; pending: number; expired: number; cancelled: number; gmv: number };
  orders: { total: number; paid: number; pending: number; expired: number; cancelled: number; gmv: number };
  topSports: { sport: string; count: number }[];
}

/** Hub superadmin — data riil GET /admin/stats + antrean pending (AD-02). */
export default function AdminDashboard() {
  return (
    <RoleGuard allowed={['super_admin']}>
      <AdminContent />
    </RoleGuard>
  );
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function addDaysISO(base: string, delta: number): string {
  const d = new Date(`${base}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function AdminContent() {
  const { me, logout } = useAuth();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [pendingVenues, setPendingVenues] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [query, setQuery] = useState('');

  const fetchHub = useCallback(async (f: string, t: string) => {
    setLoading(true);
    setError(null);
    try {
      const token = getAccessToken();
      if (!token) throw new Error('Tidak ada token akses');
      const params = new URLSearchParams();
      if (f) params.set('from', f);
      if (t) params.set('to', t);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const [s, v] = await Promise.all([
        apiFetch<StatsData>(`/admin/stats${qs}`, token),
        apiFetch<AdminListResponse | AdminRow[]>('/admin/venues?status=pending', token),
      ]);
      setStats(s);
      const rows = Array.isArray(v) ? v : (v.data ?? []);
      setPendingVenues(rows.slice(0, 3));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal memuat hub');
      setStats(null);
      setPendingVenues([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchHub(from, to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  const preset7 = () => {
    const t = todayISO();
    setFrom(addDaysISO(t, -6));
    setTo(t);
  };
  const presetMonth = () => {
    const t = todayISO();
    setFrom(`${t.slice(0, 7)}-01`);
    setTo(t);
  };

  const gmv = (stats?.bookings.gmv ?? 0) + (stats?.orders.gmv ?? 0);
  // Komisi final 5% dari GMV — dihitung di klien, bukan angka server.
  const platformFee = Math.round(gmv * COMMISSION_RATE);
  const paidBookings = stats?.bookings.paid ?? 0;
  const totalBookings = stats?.bookings.total ?? 0;
  const conv = totalBookings > 0 ? (paidBookings / totalBookings) * 100 : 0;

  const filteredVenues = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pendingVenues;
    return pendingVenues.filter((r) =>
      [r['name'], r['title'], r['city'], r['address'], r['id']]
        .map((v) => String(v ?? '').toLowerCase())
        .some((s) => s.includes(q)),
    );
  }, [pendingVenues, query]);

  const topTotal = useMemo(
    () => (stats?.topSports ?? []).reduce((a, s) => a + (s.count || 0), 0),
    [stats],
  );

  /** Ekspor CSV sisi klien dari data tabel yang tampil (fitur riil, tanpa API). */
  const exportCSV = () => {
    const lines = ['tipe,nama,detail,nilai'];
    pendingVenues.forEach((r) => {
      const nama = String(r['name'] ?? r['title'] ?? r['id'] ?? '—').replace(/"/g, '""');
      const loc = String(r['city'] ?? r['address'] ?? '—').replace(/"/g, '""');
      lines.push(`venue_pending,"${nama}","${loc}",`);
    });
    (stats?.topSports ?? []).forEach((s) => {
      lines.push(`olahraga,"${s.sport.replace(/"/g, '""')}",jumlah,${s.count}`);
    });
    lines.push(`ringkasan,"GMV total","${from || '—'} s/d ${to || '—'}",${gmv}`);
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audit-hub.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Shell
      me={me}
      onLogout={logout}
      nav={ADMIN_NAV}
      title="Superadmin Ecosystem Overview & Control Hub"
      subtitle="Sentralisasi pemantauan multi-venue, kepatuhan legalitas, arus transaksi GMV, dan sportivitas komunitas."
      searchQuery={query}
      onSearchQuery={setQuery}
      searchPlaceholder="Cari venue dalam antrean (nama/kota)…"
    >
      {/* Strip perintah: preset rentang + tanggal manual (didukung /admin/stats?from&to) */}
      <section className="ks-strip" aria-label="Rentang tanggal dan ekspor">
        <span className="ks-chip">Superadmin Panel</span>
        <div className="ks-strip-group" role="group" aria-label="Preset rentang">
          <button type="button" className="ks-btn ks-btn-ghost ks-btn-sm" onClick={preset7}>
            7 Hari Terakhir
          </button>
          <button type="button" className="ks-btn ks-btn-ghost ks-btn-sm" onClick={presetMonth}>
            Bulan Ini
          </button>
        </div>
        <div className="ks-strip-group">
          <label className="ks-dateline">
            Dari <input type="date" className="ks-date" aria-label="Dari tanggal" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="ks-dateline">
            Sampai <input type="date" className="ks-date" aria-label="Sampai tanggal" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <button type="button" className="ks-btn ks-btn-ghost ks-btn-sm" onClick={() => void fetchHub(from, to)} disabled={loading}>
            {loading ? 'Memuat…' : 'Muat ulang'}
          </button>
        </div>
        <button
          type="button"
          className="ks-btn ks-btn-primary ks-btn-sm"
          onClick={exportCSV}
          disabled={loading || (!stats && pendingVenues.length === 0)}
        >
          ⬇ Audit CSV
        </button>
      </section>

      {error && <p className="ks-error" role="alert">⚠️ {error}</p>}
      {loading && !stats && <p className="ks-muted-text">Memuat data hub…</p>}

      {stats && (
        <>
          {/* KPI — angka riil dari GET /admin/stats */}
          <section className="ks-grid ks-grid-4" aria-label="Indikator utama">
            <div className="ks-card">
              <p className="label">💰 Total Gross Merchandise Value</p>
              <p className="value sm">{formatIDR(gmv)}</p>
              <p className="ks-muted-text ks-sub">Booking + orders · {stats.range.from || '—'} → {stats.range.to || '—'}</p>
            </div>
            <div className="ks-card">
              <p className="label">🎟 Total Booking Berhasil</p>
              <p className="value sm">{paidBookings.toLocaleString('id-ID')} <span className="ks-muted-text" style={{ fontSize: 13, fontWeight: 400 }}>/ {totalBookings.toLocaleString('id-ID')} reservasi</span></p>
              <p className="ks-muted-text ks-sub">Konversi {conv.toFixed(1)}%</p>
            </div>
            <div className="ks-card">
              <p className="label">👥 Atlet & Komunitas (akun terdaftar)</p>
              <p className="value sm">{stats.users.total.toLocaleString('id-ID')} <span className="ks-muted-text" style={{ fontSize: 13, fontWeight: 400 }}>akun</span></p>
              <p className="ks-muted-text ks-sub">Aktif 7 hari: {stats.users.active7d} · 30 hari: {stats.users.active30d}</p>
            </div>
            <div className="ks-card ks-card-hl">
              <p className="label">🏦 Platform Fee (komisi final 5% dari GMV — dihitung di klien)</p>
              <p className="value sm">{formatIDR(platformFee)}</p>
              <p className="ks-muted-text ks-sub">= {formatIDR(gmv)} × 5%</p>
            </div>
          </section>

          {/* Antrean verifikasi venue — 3 terbaru dari GET /admin/venues?status=pending */}
          <section className="ks-card ks-section" aria-labelledby="h-verif">
            <div className="ks-sec-head">
              <div>
                <h2 id="h-verif" className="ks-panel-title">Verifikasi & Approval Venue Baru</h2>
                <p className="ks-muted-text ks-sub">
                  {stats.venues.pending} permohonan menunggu · menampilkan {filteredVenues.length} terbaru
                  {query.trim() ? ` (filter: “${query.trim()}”)` : ''}
                </p>
              </div>
              <Link className="ks-btn ks-btn-primary ks-btn-sm" href="/dashboard/admin/approvals">
                Buka approvals
              </Link>
            </div>
            {filteredVenues.length === 0 ? (
              <EmptyState
                icon="✅"
                title={query.trim() ? 'Tidak cocok dengan pencarian' : 'Antrean kosong'}
                desc={query.trim()
                  ? `Tidak ada venue pending yang cocok dengan “${query.trim()}”.`
                  : 'Tidak ada venue menunggu verifikasi saat ini.'}
              />
            ) : (
              <div className="ks-table-wrap">
                <table className="ks-table">
                  <thead>
                    <tr>
                      <th scope="col">Nama fasilitas & lokasi</th>
                      <th scope="col">Status</th>
                      <th scope="col">Dibuat</th>
                      <th scope="col">Tindakan admin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVenues.map((r, i) => (
                      <tr key={String(r['id'] ?? i)}>
                        <td>
                          <strong>{disp(r['name'] ?? r['title'] ?? r['id'])}</strong>
                          <div className="ks-history">{disp(r['city'] ?? r['address'] ?? '—')}</div>
                        </td>
                        <td>{disp(r['status'] ?? 'pending')}</td>
                        <td>{disp(r['createdAt'] ?? r['created_at'] ?? '—')}</td>
                        <td>
                          <Link className="ks-btn ks-btn-ghost ks-btn-sm" href="/dashboard/admin/approvals">
                            Tinjau detail
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="ks-grid ks-grid-2">
            {/* Transaksi per olahraga — count riil; GMV per sport TIDAK ditampilkan */}
            <section className="ks-card ks-section" aria-labelledby="h-sport">
              <h2 id="h-sport" className="ks-panel-title">Transaksi per Olahraga</h2>
              <p className="ks-muted-text ks-sub">
                Jumlah transaksi riil per olahraga. Rincian GMV per olahraga belum disediakan API
                sehingga tidak ditampilkan. <span className="ks-code">TODO API-W05: stats-per-sport</span>
              </p>
              {(stats.topSports ?? []).length === 0 ? (
                <EmptyState icon="📊" title="Belum ada data olahraga" desc="Tidak ada transaksi per olahraga pada rentang ini." />
              ) : (
                <ul className="ks-sportlist">
                  {(stats.topSports ?? []).map((s) => {
                    const share = topTotal > 0 ? (s.count / topTotal) * 100 : 0;
                    return (
                      <li key={s.sport} className="ks-sportrow">
                        <div className="ks-sporthead">
                          <strong>{s.sport}</strong>
                          <span className="ks-muted-text">{s.count.toLocaleString('id-ID')} transaksi · {share.toFixed(1)}%</span>
                        </div>
                        <div className="ks-bar" role="img" aria-label={`${s.sport}: ${s.count} transaksi (${share.toFixed(1)} persen)`}>
                          <div className="ks-bar-fill" style={{ width: `${share.toFixed(1)}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Fee config — read-only dari konstanta */}
            <section className="ks-card ks-section" aria-labelledby="h-fee">
              <div className="ks-sec-head">
                <div>
                  <h2 id="h-fee" className="ks-panel-title">Konfigurasi Fee Platform</h2>
                  <p className="ks-muted-text ks-sub">
                    Nilai read-only dari konstanta klien. <span className="ks-code">TODO API-W03: endpoint konfigurasi fee</span>
                  </p>
                </div>
                <span className="ks-chip">Live Monetization</span>
              </div>
              <dl className="ks-fee">
                <div>
                  <dt>Biaya layanan pemain (per order checkout)</dt>
                  <dd>{formatIDR(SERVICE_FEE_RP)} / order · Aktif</dd>
                </div>
                <div>
                  <dt>Komisi venue rekanan (dari GMV)</dt>
                  <dd>{(COMMISSION_RATE * 100).toFixed(0)}% · komisi final</dd>
                </div>
              </dl>
              <div className="ks-fee-actions">
                <button type="button" className="ks-btn ks-btn-ghost ks-btn-sm" disabled title="TODO API-W03: edit margin menunggu endpoint konfigurasi fee">
                  Edit Margin
                </button>
                {/* TODO: halaman voucher belum ada — jangan arahkan ke rute kosong. */}
                <button type="button" className="ks-btn ks-btn-primary ks-btn-sm" disabled title="TODO: halaman voucher belum ada">
                  🎟 Buat Voucher (segera)
                </button>
              </div>
            </section>
          </div>

          {/* Moderasi/dispute — DISEMBUNYIKAN, tanpa tiket palsu */}
          <section className="ks-card ks-section" aria-labelledby="h-mod">
            <h2 id="h-mod" className="ks-panel-title">Pusat Moderasi Sparing & Laporan Sportivitas</h2>
            <EmptyState
              icon="🛡"
              title="Moderasi belum tersambung"
              desc="Belum ada endpoint dispute/moderasi. Bagian ini disembunyikan sampai data riil tersedia (TODO API-W02) — tidak ada tiket palsu yang ditampilkan."
            />
          </section>

          {/* Aktivitas — DISEMBUNYIKAN, tanpa log palsu */}
          <section className="ks-card ks-section" aria-labelledby="h-act">
            <h2 id="h-act" className="ks-panel-title">Aktivitas Ekosistem Real-Time</h2>
            <EmptyState
              icon="📡"
              title="Log aktivitas belum tersedia"
              desc="Belum ada endpoint streaming aktivitas. Bagian ini disembunyikan sampai data riil tersedia (TODO API-W04) — tidak ada log palsu yang ditampilkan."
            />
          </section>
        </>
      )}
    </Shell>
  );
}
