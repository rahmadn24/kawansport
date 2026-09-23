'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RoleGuard } from '@/components/RoleGuard';
import { OWNER_NAV, Shell } from '@/components/Shell';
import { useAuth } from '@/lib/auth';

/** Entri venue manager owner (WEB-03, Trello #81). */
export default function OwnerVenuesPage() {
  return (
    <RoleGuard allowed={['venue_owner']}>
      <VenuesEntry />
    </RoleGuard>
  );
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function VenuesEntry() {
  const { me, logout } = useAuth();
  const router = useRouter();
  const [venueId, setVenueId] = useState('');
  const [error, setError] = useState<string | null>(null);

  function openVenue(e: React.FormEvent) {
    e.preventDefault();
    const id = venueId.trim();
    if (!UUID_RE.test(id)) {
      setError('ID venue harus UUID valid (contoh: 123e4567-e89b-12d3-a456-426614174000).');
      return;
    }
    setError(null);
    router.push(`/dashboard/owner/venues/${id}`);
  }

  return (
    <Shell
      me={me}
      onLogout={logout}
      nav={OWNER_NAV}
      title="Venue Saya"
      subtitle="Kelola operasional venue Anda: jadwal slot, check-in, dan ulasan pemain."
    >
      <section className="ks-card">
        <h2 className="ks-panel-title">Buka venue manager</h2>
        <p className="ks-muted-text" style={{ fontSize: 13, margin: '0 0 12px' }}>
          Tempel ID (UUID) venue milik Anda untuk membuka halaman pengelolaannya.
          Halaman berikutnya memverifikasi kepemilikan (ID owner venue vs akun
          login) sebelum menampilkan data.
        </p>
        <form onSubmit={openVenue} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <label style={{ flex: '1 1 280px', fontSize: 13 }}>
            ID venue
            <input
              className="ks-input"
              style={{ marginTop: 4 }}
              value={venueId}
              onChange={(e) => setVenueId(e.target.value)}
              placeholder="UUID venue, mis. 123e4567-…"
              aria-label="ID venue (UUID)"
              spellCheck={false}
            />
          </label>
          <button className="ks-btn ks-btn-primary" type="submit" style={{ alignSelf: 'flex-end' }}>
            Buka →
          </button>
        </form>
        {error && (
          <p className="ks-error" role="alert" style={{ marginTop: 12 }}>
            ⚠️ {error}
          </p>
        )}
      </section>

      <section className="ks-card" style={{ marginTop: 16 }}>
        <h2 className="ks-panel-title">TODO API-W05 — daftar venue milik owner</h2>
        <p className="ks-muted-text" style={{ fontSize: 13, margin: 0 }}>
          Belum ada endpoint daftar venue milik owner di API
          (<span className="ks-code">GET /venues</span> hanya mengembalikan venue{' '}
          <span className="ks-code">approved</span> publik tanpa filter owner, dan tidak
          ada <span className="ks-code">GET /venues/mine</span>). Karena itu daftar
          pilihan venue belum bisa ditampilkan; owner hanya boleh membuka venue
          sendiri via ID manual, dan halaman detail menolak venue milik orang lain
          di sisi klien (selain mengandalkan guard server).
        </p>
      </section>
    </Shell>
  );
}
