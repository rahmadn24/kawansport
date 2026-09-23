'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RoleGuard } from '@/components/RoleGuard';
import { OWNER_NAV, Shell } from '@/components/Shell';
import { EmptyState, StatusBadge, formatIDR } from '@/components/ui';
import { apiFetch } from '@/lib/api';
import { getAccessToken, useAuth } from '@/lib/auth';

/* ---------- Tipe respons API yang ADA (mirror server, lokal halaman) ---------- */

interface CourtInfo {
  id: string;
  venueId: string;
  sport: string;
  name: string;
  pricePerHour: number;
  status: string;
}

interface VenueDetail {
  id: string;
  name: string;
  address: string;
  sports: string[];
  status: string;
  owner: { id: string; email: string; displayName: string | null };
  courts: CourtInfo[];
}

type SlotStatus = 'free' | 'held' | 'booked';

interface SlotInfo {
  date: string;
  start: string;
  end: string;
  startMinute: number;
  endMinute: number;
  status: SlotStatus;
}

interface AvailabilityRes {
  courtId: string;
  date: string;
  slots: SlotInfo[];
}

interface RatingsRes {
  data: Array<{ id: string; score: number }>;
  meta: { page: number; limit: number; total: number };
}

interface BookingItem {
  id: string;
  courtId: string;
  date: string;
  status: string;
  amount: number;
}

/* ---------- Util tanggal lokal (kemarin/hari ini/besok + manual) ---------- */

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function shiftISO(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return toISODate(dt);
}

function prettyDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

interface Sel {
  courtId: string;
  startMinute: number;
}

/** Halaman venue manager owner (WEB-03, Trello #81) — Stitch court_venue_manager. */
export default function OwnerVenueManagerPage({ params }: { params: { id: string } }) {
  return (
    <RoleGuard allowed={['venue_owner']}>
      <ManagerContent venueId={params.id} />
    </RoleGuard>
  );
}

function ManagerContent({ venueId }: { venueId: string }) {
  const { me, logout } = useAuth();
  const today = useMemo(() => toISODate(new Date()), []);
  const [dateISO, setDateISO] = useState(today);

  const [venue, setVenue] = useState<VenueDetail | null>(null);
  const [venueError, setVenueError] = useState<string | null>(null);
  const [loadingVenue, setLoadingVenue] = useState(true);

  const [avail, setAvail] = useState<Record<string, SlotInfo[]>>({});
  const [availCourtError, setAvailCourtError] = useState<Record<string, string>>({});
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [availError, setAvailError] = useState<string | null>(null);

  const [ratingAvg, setRatingAvg] = useState<number | null>(null);
  const [ratingCount, setRatingCount] = useState<number | null>(null);
  const [ratingNote, setRatingNote] = useState<string | null>(null);

  // Khusus super_admin: /admin/bookings riil (owner tidak punya endpoint ini).
  const [adminPaidCount, setAdminPaidCount] = useState<number | null>(null);
  const [adminRevenue, setAdminRevenue] = useState<number | null>(null);

  const [selected, setSelected] = useState<Sel | null>(null);
  const [checkinCode, setCheckinCode] = useState('');
  const scannerRef = useRef<HTMLInputElement>(null);

  /* ----- Muat detail venue (GET /venues/:id, owner venue bisa lihat miliknya) ----- */
  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setVenueError('Tidak ada token akses.');
      setLoadingVenue(false);
      return;
    }
    setLoadingVenue(true);
    setVenueError(null);
    apiFetch<VenueDetail>(`/venues/${venueId}`, token)
      .then(setVenue)
      .catch((e: unknown) => {
        // Guard server: venue non-approved milik orang lain → 404 (tidak bocor).
        setVenueError(e instanceof Error ? e.message : 'Gagal memuat venue');
        setVenue(null);
      })
      .finally(() => setLoadingVenue(false));
  }, [venueId]);

  // Guard data klien: owner hanya boleh venue sendiri. Super_admin lolos (RoleGuard).
  // CATATAN: guard server untuk venue `approved` tidak membatasi owner — detail
  // approved bisa dibaca siapa pun — sehingga cek klien ini WAJIB dipertahankan
  // sampai ada endpoint list-mine (TODO API-W05) / guard owner di server.
  const ownershipDenied =
    venue !== null &&
    me !== null &&
    me.role === 'venue_owner' &&
    venue.owner.id !== me.id;

  const courts = useMemo(() => venue?.courts ?? [], [venue]);

  /* ----- Muat availability per court (GET /courts/:id/availability?date=) ----- */
  const refreshAvail = useCallback(async () => {
    const token = getAccessToken();
    if (!token || courts.length === 0) {
      setAvail({});
      return;
    }
    setLoadingAvail(true);
    setAvailError(null);
    try {
      const results = await Promise.all(
        courts.map(async (c) => {
          try {
            const res = await apiFetch<AvailabilityRes>(
              `/courts/${c.id}/availability?date=${dateISO}`,
              token,
            );
            return { courtId: c.id, slots: res.slots ?? [], error: null as string | null };
          } catch (e: unknown) {
            return {
              courtId: c.id,
              slots: [] as SlotInfo[],
              error: e instanceof Error ? e.message : 'Gagal memuat slot',
            };
          }
        }),
      );
      const map: Record<string, SlotInfo[]> = {};
      const errs: Record<string, string> = {};
      for (const r of results) {
        map[r.courtId] = r.slots;
        if (r.error) errs[r.courtId] = r.error;
      }
      setAvail(map);
      setAvailCourtError(errs);
    } catch (e: unknown) {
      setAvailError(e instanceof Error ? e.message : 'Gagal memuat jadwal');
    } finally {
      setLoadingAvail(false);
    }
  }, [courts, dateISO]);

  useEffect(() => {
    if (!ownershipDenied) void refreshAvail();
  }, [refreshAvail, ownershipDenied]);

  useEffect(() => setSelected(null), [dateISO, venueId]);

  /* ----- Rating venue (GET /ratings/venues/:venueId/ratings, publik) ----- */
  useEffect(() => {
    if (!venue || ownershipDenied) return;
    const token = getAccessToken();
    if (!token) return;
    apiFetch<RatingsRes>(`/ratings/venues/${venue.id}/ratings?page=1&limit=100`, token)
      .then((res) => {
        const rows = res.data ?? [];
        const total = res.meta?.total ?? rows.length;
        setRatingCount(total);
        if (rows.length === 0) {
          setRatingAvg(null);
        } else {
          const sum = rows.reduce((a, r) => a + (Number(r.score) || 0), 0);
          setRatingAvg(sum / rows.length);
        }
        setRatingNote(
          total > rows.length
            ? `Rata-rata dihitung dari ${rows.length} ulasan pertama dari ${total} total (TODO: agregat penuh halaman berikut).`
            : null,
        );
      })
      .catch(() => {
        setRatingAvg(null);
        setRatingCount(null);
      });
  }, [venue, ownershipDenied]);

  /* ----- Pendapatan & reservasi real HANYA bila super_admin (/admin/bookings) ----- */
  useEffect(() => {
    if (!venue || ownershipDenied || me?.role !== 'super_admin') return;
    const token = getAccessToken();
    if (!token) return;
    const courtIds = new Set(venue.courts.map((c) => c.id));
    apiFetch<{ data: BookingItem[] } | BookingItem[]>('/admin/bookings', token)
      .then((res) => {
        const rows = Array.isArray(res) ? res : (res.data ?? []);
        const mine = rows.filter((b) => courtIds.has(b.courtId) && b.date === dateISO);
        const paid = mine.filter((b) => b.status === 'paid');
        setAdminPaidCount(paid.length);
        setAdminRevenue(paid.reduce((a, b) => a + (Number(b.amount) || 0), 0));
      })
      .catch(() => {
        setAdminPaidCount(null);
        setAdminRevenue(null);
      });
  }, [venue, ownershipDenied, me, dateISO]);

  /* ----- KPI jujur dari availability real tanggal terpilih ----- */
  const { totalSlots, bookedSlots, freeSlots } = useMemo(() => {
    let total = 0;
    let booked = 0;
    for (const c of courts) {
      for (const s of avail[c.id] ?? []) {
        total += 1;
        if (s.status === 'booked') booked += 1;
      }
    }
    return { totalSlots: total, bookedSlots: booked, freeSlots: total - booked };
  }, [avail, courts]);
  const occupancy = totalSlots > 0 ? (bookedSlots / totalSlots) * 100 : null;

  /* ----- Baris jam = gabungan startMinute semua court ----- */
  const rowMinutes = useMemo(() => {
    const set = new Set<number>();
    for (const c of courts) for (const s of avail[c.id] ?? []) set.add(s.startMinute);
    return [...set].sort((a, b) => a - b);
  }, [avail, courts]);
  const slotOf = useCallback(
    (courtId: string, minute: number) => (avail[courtId] ?? []).find((s) => s.startMinute === minute) ?? null,
    [avail],
  );
  const courtById = useMemo(() => new Map(courts.map((c) => [c.id, c])), [courts]);
  const selectedSlot = selected ? slotOf(selected.courtId, selected.startMinute) : null;
  const selectedCourt = selected ? (courtById.get(selected.courtId) ?? null) : null;

  const quickOffset = shiftISO(today, 0) === dateISO ? 0 : dateISO === shiftISO(today, -1) ? -1 : dateISO === shiftISO(today, 1) ? 1 : null;

  return (
    <Shell
      me={me}
      onLogout={logout}
      nav={OWNER_NAV}
      title={venue ? venue.name : 'Venue manager'}
      subtitle={venue ? venue.address : `Memuat venue ${venueId.slice(0, 8)}…`}
    >
      {loadingVenue && <p className="ks-muted-text">Memuat venue…</p>}
      {venueError && (
        <p className="ks-error" role="alert">
          ⚠️ Gagal memuat venue: {venueError}. Venue non-approved milik orang lain
          disembunyikan server sebagai 404.
        </p>
      )}

      {venue && ownershipDenied && (
        <EmptyState
          icon="⛔"
          title="Bukan venue Anda"
          desc={`Venue "${venue.name}" dimiliki akun lain (${venue.owner.email}). Owner hanya boleh mengelola venue sendiri — ID ini tidak dibuka. Guard server mengandalkan 404 untuk venue non-approved; untuk venue approved yang publik, penolakan klien ini yang mencegah akses silang.`}
        />
      )}

      {venue && !ownershipDenied && (
        <>
          {/* ---------- Header venue (Stitch: hub operasional) ---------- */}
          <section className="ks-card" aria-label="Ringkasan venue">
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: '1 1 240px' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontSize: 20 }}>{venue.name}</h2>
                  {venue.sports.map((s) => (
                    <span key={s} className="ks-chip">{s}</span>
                  ))}
                  <StatusBadge status={venue.status} />
                </div>
                <p className="ks-muted-text" style={{ fontSize: 13, margin: '6px 0 0' }}>
                  📍 {venue.address} · {courts.length} lapangan
                </p>
                <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 13, marginTop: 8 }}>
                  <input
                    type="checkbox"
                    checked={venue.status === 'approved'}
                    disabled
                    title="TODO: toggle status butuh endpoint PATCH status venue owner — UpdateVenueDto saat ini tidak menerima field status, sehingga toggle dinonaktifkan agar tidak menipu"
                    aria-label="Status buka venue (dinonaktifkan, butuh endpoint baru)"
                  />
                  Status operasional (dinonaktifkan — TODO endpoint PATCH status)
                </label>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="ks-btn ks-btn-primary ks-btn-sm"
                  disabled
                  title="TODO API-W06: endpoint booking walk-in/kasir belum ada — tombol dinonaktifkan jujur"
                >
                  + Buat Booking Walk-in
                </button>
                <button
                  type="button"
                  className="ks-btn ks-btn-ghost ks-btn-sm"
                  onClick={() => scannerRef.current?.focus()}
                  title="Fokus ke kolom kode booking di stasiun check-in"
                >
                  Scan QR Tiket
                </button>
                <button
                  type="button"
                  className="ks-btn ks-btn-ghost ks-btn-sm"
                  disabled
                  title="TODO API-W08: endpoint payout belum ada — tombol dinonaktifkan jujur"
                >
                  Cairkan Payout
                </button>
              </div>
            </div>
          </section>

          {/* ---------- KPI: hanya angka dari respons real ---------- */}
          <div className="ks-grid ks-grid-4" style={{ marginTop: 16 }}>
            <div className="ks-card">
              <p className="label">📊 Okupansi slot ({prettyDate(dateISO)})</p>
              {occupancy === null ? (
                <p className="value sm">—</p>
              ) : (
                <p className="value sm">{occupancy.toFixed(1)}%</p>
              )}
              <p className="ks-muted-text" style={{ fontSize: 12, margin: '4px 0 0' }}>
                {totalSlots === 0
                  ? 'Belum ada slot dari availability.'
                  : `Terisi ${bookedSlots} / ${totalSlots} slot · sisa ${freeSlots}. Dihitung dari GET availability real per court.`}
              </p>
            </div>
            <div className="ks-card">
              <p className="label">🎟️ Reservasi (slot terisi)</p>
              <p className="value sm">{totalSlots === 0 ? '—' : `${bookedSlots} sesi`}</p>
              <p className="ks-muted-text" style={{ fontSize: 12, margin: '4px 0 0' }}>
                Dari status booked availability tanggal terpilih. Daftar booking per
                venue belum ada endpoint (TODO API-W05) — nama pemesan tidak ditampilkan.
              </p>
            </div>
            <div className="ks-card">
              <p className="label">💰 Pendapatan</p>
              {me?.role === 'super_admin' && adminRevenue !== null ? (
                <>
                  <p className="value sm">{formatIDR(adminRevenue)}</p>
                  <p className="ks-muted-text" style={{ fontSize: 12, margin: '4px 0 0' }}>
                    {adminPaidCount} booking lunas venue ini tanggal {dateISO}
                    (via /admin/bookings — khusus super_admin).
                  </p>
                </>
              ) : (
                <>
                  <p className="value sm">Belum tersedia</p>
                  <p className="ks-muted-text" style={{ fontSize: 12, margin: '4px 0 0' }}>
                    TODO API-W05: owner tidak punya endpoint daftar booking venue,
                    jadi pendapatan tidak dihitung (tanpa angka palsu).
                  </p>
                </>
              )}
            </div>
            <div className="ks-card">
              <p className="label">⭐ Rating pemain</p>
              {ratingAvg === null || ratingCount === null ? (
                <p className="value sm">—</p>
              ) : (
                <p className="value sm">{ratingAvg.toFixed(1)} / 5,0</p>
              )}
              <p className="ks-muted-text" style={{ fontSize: 12, margin: '4px 0 0' }}>
                {ratingCount === null
                  ? 'Gagal memuat rating.'
                  : ratingCount === 0
                    ? 'Belum ada ulasan.'
                    : `${ratingCount} ulasan. Dihitung dari GET ratings venue real.`}
                {ratingNote ? ` ${ratingNote}` : ''}
              </p>
            </div>
          </div>
          {/* TODO API-W08: kartu saldo payout DISEMBUNYIKAN — tidak ada endpoint payout,
              menampilkan angka akan memalsukan data keuangan. */}

          {/* ---------- Grid jadwal: kolom court × baris jam (data real) ---------- */}
          <section className="ks-card" style={{ marginTop: 16 }} aria-label="Jadwal dan slot lapangan">
            <div className="ks-sec-head">
              <div>
                <h2 className="ks-panel-title">📅 Jadwal &amp; Slot Lapangan</h2>
                <p className="ks-muted-text" style={{ fontSize: 13, margin: 0 }}>
                  {prettyDate(dateISO)} · status sel dari GET availability real per court.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <div role="group" aria-label="Pilih hari">
                  <button
                    type="button"
                    className={`ks-btn ks-btn-sm${quickOffset === -1 ? ' ks-btn-primary' : ' ks-btn-ghost'}`}
                    onClick={() => setDateISO(shiftISO(today, -1))}
                    aria-pressed={quickOffset === -1}
                  >
                    Kemarin
                  </button>{' '}
                  <button
                    type="button"
                    className={`ks-btn ks-btn-sm${quickOffset === 0 ? ' ks-btn-primary' : ' ks-btn-ghost'}`}
                    onClick={() => setDateISO(today)}
                    aria-pressed={quickOffset === 0}
                  >
                    Hari ini
                  </button>{' '}
                  <button
                    type="button"
                    className={`ks-btn ks-btn-sm${quickOffset === 1 ? ' ks-btn-primary' : ' ks-btn-ghost'}`}
                    onClick={() => setDateISO(shiftISO(today, 1))}
                    aria-pressed={quickOffset === 1}
                  >
                    Besok
                  </button>
                </div>
                <input
                  type="date"
                  className="ks-date"
                  aria-label="Tanggal manual (YYYY-MM-DD)"
                  value={dateISO}
                  onChange={(e) => e.target.value && setDateISO(e.target.value)}
                />
                <button
                  type="button"
                  className="ks-btn ks-btn-ghost ks-btn-sm"
                  onClick={() => void refreshAvail()}
                  disabled={loadingAvail}
                >
                  {loadingAvail ? 'Memuat…' : '🔄 Muat ulang'}
                </button>
              </div>
            </div>

            <p className="ks-muted-text" style={{ fontSize: 12, margin: '0 0 12px' }}>
              Legenda: <span className="ks-badge paid">booked</span>{' '}
              <span className="ks-badge pending">held</span>{' '}
              <span className="ks-badge open">free</span> — klik sel hanya menampilkan
              info (tanpa aksi, belum ada API aksi slot untuk owner).
            </p>

            {availError && (
              <p className="ks-error" role="alert">⚠️ {availError}</p>
            )}
            {courts.length === 0 && (
              <EmptyState
                icon="🏟️"
                title="Belum ada lapangan"
                desc="Venue ini belum memiliki court, sehingga tidak ada jadwal yang bisa ditampilkan."
              />
            )}
            {courts.length > 0 && rowMinutes.length === 0 && !loadingAvail && (
              <EmptyState
                icon="📅"
                title="Tidak ada slot tanggal ini"
                desc="API availability tidak mengembalikan slot untuk tanggal terpilih (kemungkinan di luar jam operasional court). Coba tanggal lain."
              />
            )}
            {courts.length > 0 && rowMinutes.length > 0 && (
              <div className="ks-table-wrap">
                <table className="ks-table">
                  <caption className="ks-muted-text" style={{ padding: 8, fontSize: 12 }}>
                    Matriks slot {prettyDate(dateISO)} — kolom lapangan, baris jam.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Jam / Waktu</th>
                      {courts.map((c) => (
                        <th key={c.id} scope="col">
                          {c.name}
                          <div style={{ fontWeight: 400, textTransform: 'none' }}>
                            {c.sport} · {formatIDR(c.pricePerHour)}/jam
                          </div>
                          {availCourtError[c.id] && (
                            <div style={{ fontWeight: 400, textTransform: 'none' }}>
                              ⚠️ {availCourtError[c.id]}
                            </div>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rowMinutes.map((minute) => {
                      const label = slotOf(courts[0].id, minute);
                      return (
                        <tr key={minute}>
                          <th scope="row">
                            {label ? `${label.start}–${label.end}` : `${minute}`}
                          </th>
                          {courts.map((c) => {
                            const s = slotOf(c.id, minute);
                            if (!s) return <td key={c.id}>—</td>;
                            const active =
                              selected?.courtId === c.id && selected?.startMinute === minute;
                            return (
                              <td key={c.id}>
                                <button
                                  type="button"
                                  className={`ks-btn ks-btn-sm${active ? ' ks-btn-primary' : ' ks-btn-ghost'}`}
                                  onClick={() => setSelected({ courtId: c.id, startMinute: minute })}
                                  aria-pressed={active}
                                  aria-label={`${c.name} ${s.start} sampai ${s.end}: ${s.status}`}
                                  title="Klik untuk info sel (tanpa aksi perubahan)"
                                >
                                  {s.status === 'free' ? `Tersedia · ${formatIDR(c.pricePerHour)}` : s.status}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {selected && selectedSlot && selectedCourt && (
              <div className="ks-card" style={{ marginTop: 12 }} role="status" aria-live="polite">
                <p style={{ margin: 0, fontSize: 14 }}>
                  <strong>{selectedCourt.name}</strong> · {selectedSlot.start}–{selectedSlot.end} ·{' '}
                  <StatusBadge status={selectedSlot.status} /> · {formatIDR(selectedCourt.pricePerHour)}/jam
                </p>
                <p className="ks-muted-text" style={{ fontSize: 12, margin: '4px 0 0' }}>
                  Informatif saja — aksi atas slot (hold/batal/lunas walk-in) butuh API baru.
                </p>
              </div>
            )}
          </section>

          {/* ---------- Stasiun check-in: input real, validasi DISABLED ---------- */}
          <section className="ks-card" style={{ marginTop: 16 }} aria-label="Validasi tiket dan check-in">
            <h2 className="ks-panel-title">🎫 Validasi Tiket &amp; Check-In Pemain</h2>
            <p className="ks-muted-text" style={{ fontSize: 13, margin: '0 0 12px' }}>
              Ketik kode booking (contoh: KS-88219) atau scan QR pemain.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                ref={scannerRef}
                className="ks-input"
                style={{ flex: '1 1 240px' }}
                value={checkinCode}
                onChange={(e) => setCheckinCode(e.target.value)}
                placeholder="Ketik Kode Booking atau scan QR…"
                aria-label="Kode booking untuk check-in"
              />
              <button
                type="button"
                className="ks-btn ks-btn-primary"
                disabled
                title="TODO API-W07: endpoint validasi/check-in QR belum ada — tombol dinonaktifkan agar tidak ada validasi palsu"
              >
                Validasi
              </button>
            </div>
            {/* TODO API-W07: riwayat check-in DISEMBUNYIKAN — belum ada endpoint
                riwayat check-in; menampilkan daftar akan memalsukan kehadiran. */}
            <p className="ks-muted-text" style={{ fontSize: 12, margin: '12px 0 0' }}>
              TODO API-W07: riwayat check-in disembunyikan sampai ada endpoint riwayat
              check-in yang sah.
            </p>
          </section>

          {/* TODO ST-10: panel Rental & gear DISEMBUNYIKAN — belum ada endpoint
              inventaris rental; tidak ditampilkan agar tidak ada stok palsu. */}
          <section className="ks-card" style={{ marginTop: 16 }} aria-label="Rental dan gear">
            <h2 className="ks-panel-title">🎒 Rental &amp; Gear Add-On</h2>
            <p className="ks-muted-text" style={{ fontSize: 13, margin: 0 }}>
              TODO ST-10: disembunyikan — belum ada endpoint inventaris rental,
              sehingga stok/unit tidak ditampilkan (tanpa angka palsu).
            </p>
          </section>
        </>
      )}
    </Shell>
  );
}
