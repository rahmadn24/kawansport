'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RoleGuard } from '@/components/RoleGuard';
import { OWNER_NAV, Shell } from '@/components/Shell';
import { EmptyState, StatusBadge } from '@/components/ui';
import { apiFetch, disp } from '@/lib/api';
import { getAccessToken, useAuth } from '@/lib/auth';

interface MineVenue {
  id: string;
  name: string;
  status: string;
  courtsCount: number;
}

interface MineRes {
  data: MineVenue[];
  meta: { total: number };
}

/** Entri venue manager owner (WEB-03) — daftar real GET /venues/mine (API-W05). */
export default function OwnerVenuesPage() {
  return (
    <RoleGuard allowed={['venue_owner']}>
      <VenuesEntry />
    </RoleGuard>
  );
}

function VenuesEntry() {
  const { me, logout } = useAuth();
  const [venues, setVenues] = useState<MineVenue[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // super_admin boleh ?all=true untuk semua venue (non-admin all=true → 403).
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setError('Tidak ada token akses.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const qs = showAll ? '?all=true' : '';
    apiFetch<MineRes>(`/venues/mine${qs}`, token)
      .then((r) => {
        setVenues(r.data ?? []);
        setTotal(r.meta?.total ?? (r.data ?? []).length);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Gagal memuat daftar venue');
        setVenues([]);
        setTotal(null);
      })
      .finally(() => setLoading(false));
  }, [showAll]);

  return (
    <Shell
      me={me}
      onLogout={logout}
      nav={OWNER_NAV}
      title="Venue Saya"
      subtitle="Kelola operasional venue Anda: jadwal slot, check-in, dan ulasan pemain."
    >
      <section className="ks-card" aria-labelledby="h-mine">
        <div className="ks-sec-head">
          <div>
            <h2 id="h-mine" className="ks-panel-title">Daftar venue saya</h2>
            <p className="ks-muted-text" style={{ fontSize: 13, margin: 0 }}>
              {total === null
                ? 'Data real dari GET /venues/mine.'
                : `${total} venue · data real dari GET /venues/mine${showAll ? '?all=true' : ''}.`}
            </p>
          </div>
          {me?.role === 'super_admin' && (
            <label style={{ fontSize: 13, display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                aria-label="Tampilkan semua venue (super_admin)"
              />
              Semua venue (super_admin)
            </label>
          )}
        </div>

        {error && (
          <p className="ks-error" role="alert" style={{ marginTop: 12 }}>
            ⚠️ {error}
          </p>
        )}
        {loading && <p className="ks-muted-text">Memuat daftar venue…</p>}

        {!loading && !error && venues.length === 0 && (
          <EmptyState
            icon="🏟️"
            title="Belum ada venue"
            desc="Akun ini belum memiliki venue. Hubungi super_admin untuk pembuatan venue."
          />
        )}

        {!loading && !error && venues.length > 0 && (
          <div className="ks-table-wrap">
            <table className="ks-table">
              <thead>
                <tr>
                  <th scope="col">Nama venue</th>
                  <th scope="col">Status</th>
                  <th scope="col">Lapangan</th>
                  <th scope="col">Kelola</th>
                </tr>
              </thead>
              <tbody>
                {venues.map((v) => (
                  <tr key={v.id}>
                    <td><strong>{disp(v.name)}</strong></td>
                    <td><StatusBadge status={v.status} /></td>
                    <td>{v.courtsCount}</td>
                    <td>
                      <Link
                        className="ks-btn ks-btn-primary ks-btn-sm"
                        href={`/dashboard/owner/venues/${v.id}`}
                        aria-label={`Kelola venue ${v.name}`}
                      >
                        Buka →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </Shell>
  );
}
