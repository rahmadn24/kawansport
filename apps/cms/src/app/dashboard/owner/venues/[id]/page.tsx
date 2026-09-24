'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RoleGuard } from '@/components/RoleGuard';
import { OWNER_NAV, Shell } from '@/components/Shell';
import { EmptyState, StatusBadge, formatIDR } from '@/components/ui';
import { apiFetch, disp } from '@/lib/api';
import { getAccessToken, useAuth } from '@/lib/auth';

/* ---------- Tipe respons API (mirror server, lokal halaman) ---------- */

interface CourtInfo {
  id: string;
  venueId: string;
  sport: string;
  name: string;
  pricePerHour: number;
  status: string;
}

interface VenueDocument {
  id: string;
  venueId: string;
  type: string;
  url: string;
  status: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

interface VenueDetail {
  id: string;
  name: string;
  address: string;
  sports: string[];
  status: string;
  owner: { id: string; email: string; displayName: string | null };
  courts: CourtInfo[];
  documents?: VenueDocument[];
  legalitas?: 'lengkap' | 'parsial' | 'kosong';
}

type SlotStatus = 'free' | 'held' | 'booked' | 'blocked';

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

interface VenueStats {
  venueId: string;
  occupancy: { date: string; totalSlots: number; bookedSlots: number; pct: number };
  reservations: { total: number; byStatus: { pending: number; paid: number; expired: number; cancelled: number } };
  revenue: { paidCount: number; gmv: number; commissionPercent: number; net: number };
  rating: { avg: number | null; count: number };
  topCourts: { courtId: string; courtName: string; booked: number; gmv: number }[];
}

interface BlockItem {
  id: string;
  courtId: string;
  date: string;
  start: string;
  end: string;
  startMinute: number;
  endMinute: number;
  reason: string | null;
  createdBy: string;
}

interface BlocksRes {
  data: BlockItem[];
  meta: { total: number };
}

interface BookingDetail {
  id: string;
  courtId: string;
  date: string;
  status: string;
  amount: number;
  channel?: string;
  buyerName?: string | null;
  code?: string | null;
  checkedInAt?: string | null;
}

interface BalanceRes {
  payeeType: string | null;
  payeeId: string | null;
  gross: number;
  commissionPercent: number;
  net: number;
  reserved: number;
  available: number;
}

interface PayoutItem {
  id: string;
  payeeType: string;
  payeeId: string;
  amount: number;
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
  status: string;
  reference: string | null;
  reason: string | null;
  requestedBy: string;
  createdAt: string;
  updatedAt: string;
}

interface PayoutsMeRes {
  data: PayoutItem[];
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

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Terjadi kesalahan tak dikenal';
}

interface Sel {
  courtId: string;
  startMinute: number;
}

const DOC_TYPES = ['siup', 'nib', 'imb', 'sertifikat_tanah', 'mou_lainnya'];

/** Halaman venue manager owner (WEB-03) — Stitch court_venue_manager. */
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

  // Analitik real GET /venues/:id/stats?date= (API-W05).
  const [vstats, setVstats] = useState<VenueStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Blokir slot real GET /courts/:id/blocks?date= (API-W06).
  const [blocks, setBlocks] = useState<Record<string, BlockItem[]>>({});
  const [blockCourtId, setBlockCourtId] = useState('');
  const [blockStart, setBlockStart] = useState('');
  const [blockDuration, setBlockDuration] = useState('60');
  const [blockReason, setBlockReason] = useState('');
  const [blockMsg, setBlockMsg] = useState<string | null>(null);
  const [blockBusy, setBlockBusy] = useState(false);

  // Walk-in real POST /bookings/walk-in (API-W06).
  const [walkCourtId, setWalkCourtId] = useState('');
  const [walkBuyer, setWalkBuyer] = useState('');
  const [walkStart, setWalkStart] = useState('');
  const [walkMsg, setWalkMsg] = useState<string | null>(null);
  const [walkBusy, setWalkBusy] = useState(false);

  // Check-in real GET /bookings/by-code/:code + POST /bookings/:id/check-in (API-W07).
  const [checkinCode, setCheckinCode] = useState('');
  const [foundBooking, setFoundBooking] = useState<BookingDetail | null>(null);
  const [checkinMsg, setCheckinMsg] = useState<string | null>(null);
  const [checkinBusy, setCheckinBusy] = useState(false);
  const scannerRef = useRef<HTMLInputElement>(null);

  // Payout real (API-W08).
  const [balance, setBalance] = useState<BalanceRes | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [payoutsError, setPayoutsError] = useState<string | null>(null);
  const [wdAmount, setWdAmount] = useState('');
  const [wdBank, setWdBank] = useState('');
  const [wdNumber, setWdNumber] = useState('');
  const [wdName, setWdName] = useState('');
  const [wdMsg, setWdMsg] = useState<string | null>(null);
  const [wdBusy, setWdBusy] = useState(false);

  // Dokumen legalitas real (API-W01).
  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const [docUrl, setDocUrl] = useState('');
  const [docMsg, setDocMsg] = useState<string | null>(null);
  const [docBusy, setDocBusy] = useState(false);

  const [selected, setSelected] = useState<Sel | null>(null);

  /* ----- Muat detail venue (GET /venues/:id, owner venue bisa lihat miliknya) ----- */
  const refreshVenue = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setVenueError('Tidak ada token akses.');
      setLoadingVenue(false);
      return;
    }
    setLoadingVenue(true);
    setVenueError(null);
    try {
      setVenue(await apiFetch<VenueDetail>(`/venues/${venueId}`, token));
    } catch (e: unknown) {
      // Guard server: venue non-approved milik orang lain → 404 (tidak bocor).
      setVenueError(errMsg(e));
      setVenue(null);
    } finally {
      setLoadingVenue(false);
    }
  }, [venueId]);

  useEffect(() => {
    void refreshVenue();
  }, [refreshVenue]);

  // Guard data klien: owner hanya boleh venue sendiri. Super_admin lolos (RoleGuard).
  const ownershipDenied =
    venue !== null &&
    me !== null &&
    me.role === 'venue_owner' &&
    venue.owner.id !== me.id;

  const courts = useMemo(() => venue?.courts ?? [], [venue]);

  useEffect(() => {
    if (!walkCourtId && courts.length > 0) setWalkCourtId(courts[0].id);
  }, [courts, walkCourtId]);
  useEffect(() => {
    if (!blockCourtId && courts.length > 0) setBlockCourtId(courts[0].id);
  }, [courts, blockCourtId]);

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
              error: errMsg(e),
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
      setAvailError(errMsg(e));
    } finally {
      setLoadingAvail(false);
    }
  }, [courts, dateISO]);

  useEffect(() => {
    if (!ownershipDenied) void refreshAvail();
  }, [refreshAvail, ownershipDenied]);

  useEffect(() => setSelected(null), [dateISO, venueId]);

  /* ----- Analitik venue real (GET /venues/:id/stats?date=, API-W05) ----- */
  const refreshStats = useCallback(async () => {
    const token = getAccessToken();
    if (!token || !venue || ownershipDenied) return;
    setStatsError(null);
    try {
      setVstats(await apiFetch<VenueStats>(`/venues/${venue.id}/stats?date=${dateISO}`, token));
    } catch (e: unknown) {
      setStatsError(errMsg(e));
      setVstats(null);
    }
  }, [venue, ownershipDenied, dateISO]);

  useEffect(() => {
    void refreshStats();
  }, [refreshStats]);

  /* ----- Blokir slot: daftar per court (GET /courts/:id/blocks?date=) ----- */
  const refreshBlocks = useCallback(async () => {
    const token = getAccessToken();
    if (!token || courts.length === 0 || ownershipDenied) {
      setBlocks({});
      return;
    }
    try {
      const results = await Promise.all(
        courts.map(async (c) => {
          try {
            const res = await apiFetch<BlocksRes>(`/courts/${c.id}/blocks?date=${dateISO}`, token);
            return { courtId: c.id, items: res.data ?? [] };
          } catch {
            return { courtId: c.id, items: [] as BlockItem[] };
          }
        }),
      );
      const map: Record<string, BlockItem[]> = {};
      for (const r of results) map[r.courtId] = r.items;
      setBlocks(map);
    } catch {
      // Blokir gagal dimuat — grid availability tetap sumber utama status blocked.
    }
  }, [courts, dateISO, ownershipDenied]);

  useEffect(() => {
    void refreshBlocks();
  }, [refreshBlocks]);

  /* ----- Payout: saldo + riwayat (API-W08) ----- */
  const refreshPayout = useCallback(async () => {
    const token = getAccessToken();
    if (!token || !venue || ownershipDenied) return;
    setBalanceError(null);
    setPayoutsError(null);
    try {
      setBalance(await apiFetch<BalanceRes>(
        `/payouts/balance?payeeType=venue&payeeId=${venue.id}`,
        token,
      ));
    } catch (e: unknown) {
      setBalanceError(errMsg(e));
      setBalance(null);
    }
    try {
      const r = await apiFetch<PayoutsMeRes>('/payouts/me', token);
      setPayouts((r.data ?? []).filter((p) => p.payeeId === venue.id));
    } catch (e: unknown) {
      setPayoutsError(errMsg(e));
      setPayouts([]);
    }
  }, [venue, ownershipDenied]);

  useEffect(() => {
    void refreshPayout();
  }, [refreshPayout]);

  /* ----- Aksi: walk-in ----- */
  async function submitWalkin(e: React.FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    if (!token) {
      setWalkMsg('Tidak ada token akses.');
      return;
    }
    if (!walkCourtId || !walkBuyer.trim() || !walkStart.trim()) {
      setWalkMsg('Lengkapi lapangan, nama pembeli, dan jam mulai (HH:MM).');
      return;
    }
    setWalkBusy(true);
    setWalkMsg(null);
    try {
      const b = await apiFetch<BookingDetail>('/bookings/walk-in', token, {
        method: 'POST',
        body: { courtId: walkCourtId, date: dateISO, start: walkStart.trim(), buyerName: walkBuyer.trim() },
      });
      setWalkMsg(`Walk-in tercatat: booking ${b.id} · ${formatIDR(b.amount)} · kode ${b.code ?? '—'} (lunas).`);
      setWalkBuyer('');
      setWalkStart('');
      await Promise.all([refreshAvail(), refreshStats(), refreshPayout()]);
    } catch (e: unknown) {
      // 403 lintas owner / 409 slot bentrok: tampilkan pesan server apa adanya.
      setWalkMsg(`Walk-in gagal: ${errMsg(e)}`);
    } finally {
      setWalkBusy(false);
    }
  }

  /* ----- Aksi: tambah/hapus blokir slot ----- */
  async function submitBlock(e: React.FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    if (!token) {
      setBlockMsg('Tidak ada token akses.');
      return;
    }
    if (!blockCourtId || !blockStart.trim()) {
      setBlockMsg('Lengkapi lapangan dan jam mulai (HH:MM).');
      return;
    }
    setBlockBusy(true);
    setBlockMsg(null);
    try {
      const body: Record<string, unknown> = {
        date: dateISO,
        start: blockStart.trim(),
        durationMinutes: Number(blockDuration) || 60,
      };
      if (blockReason.trim()) body['reason'] = blockReason.trim();
      const b = await apiFetch<BlockItem>(`/courts/${blockCourtId}/blocks`, token, { method: 'POST', body });
      setBlockMsg(`Slot diblokir: ${b.start}–${b.end} tanggal ${b.date}.`);
      setBlockStart('');
      setBlockReason('');
      await Promise.all([refreshAvail(), refreshBlocks(), refreshStats()]);
    } catch (e: unknown) {
      setBlockMsg(`Blokir gagal: ${errMsg(e)}`);
    } finally {
      setBlockBusy(false);
    }
  }

  async function deleteBlock(courtId: string, blockId: string) {
    const token = getAccessToken();
    if (!token) {
      setBlockMsg('Tidak ada token akses.');
      return;
    }
    setBlockBusy(true);
    try {
      await apiFetch<unknown>(`/courts/${courtId}/blocks/${blockId}`, token, { method: 'DELETE' });
      setBlockMsg('Blokir dihapus — slot kembali free (kecuali ada klaim aktif).');
      await Promise.all([refreshAvail(), refreshBlocks(), refreshStats()]);
    } catch (e: unknown) {
      setBlockMsg(`Hapus blokir gagal: ${errMsg(e)}`);
    } finally {
      setBlockBusy(false);
    }
  }

  /* ----- Aksi: check-in via kode (API-W07) ----- */
  async function lookupCode(e: React.FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    if (!token) {
      setCheckinMsg('Tidak ada token akses.');
      return;
    }
    const code = checkinCode.trim();
    if (!code) {
      setCheckinMsg('Isi kode booking dulu (contoh: KS-88219).');
      return;
    }
    setCheckinBusy(true);
    setCheckinMsg(null);
    setFoundBooking(null);
    try {
      const b = await apiFetch<BookingDetail>(`/bookings/by-code/${encodeURIComponent(code)}`, token);
      setFoundBooking(b);
      setCheckinMsg(b.checkedInAt ? `Booking ditemukan — sudah check-in pada ${b.checkedInAt}.` : 'Booking ditemukan — siap check-in.');
    } catch (e: unknown) {
      // 404 lintas owner / kode tak dikenal: jujur, tanpa membocorkan data.
      setCheckinMsg(`Lookup gagal: ${errMsg(e)}`);
    } finally {
      setCheckinBusy(false);
    }
  }

  async function doCheckin() {
    const token = getAccessToken();
    if (!token || !foundBooking) return;
    setCheckinBusy(true);
    try {
      const b = await apiFetch<BookingDetail>(`/bookings/${foundBooking.id}/check-in`, token, { method: 'POST' });
      setFoundBooking(b);
      setCheckinMsg(`Check-in berhasil pada ${b.checkedInAt ?? 'sekarang'}.`);
      await Promise.all([refreshAvail(), refreshStats()]);
    } catch (e: unknown) {
      // 409 sudah check-in / status non-paid: tampilkan pesan server.
      setCheckinMsg(`Check-in gagal: ${errMsg(e)}`);
    } finally {
      setCheckinBusy(false);
    }
  }

  /* ----- Aksi: request withdraw (API-W08) ----- */
  async function submitWithdraw(e: React.FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    if (!token || !venue) {
      setWdMsg('Tidak ada token akses.');
      return;
    }
    const amount = Number(wdAmount);
    if (!Number.isInteger(amount) || amount < 1) {
      setWdMsg('Nominal harus bilangan bulat ≥ 1 rupiah.');
      return;
    }
    setWdBusy(true);
    setWdMsg(null);
    try {
      const body: Record<string, unknown> = { payeeType: 'venue', payeeId: venue.id, amount };
      if (wdBank.trim()) body['bankName'] = wdBank.trim();
      if (wdNumber.trim()) body['accountNumber'] = wdNumber.trim();
      if (wdName.trim()) body['accountName'] = wdName.trim();
      const p = await apiFetch<PayoutItem>('/payouts', token, { method: 'POST', body });
      setWdMsg(`Request withdraw tercatat: ${p.id} · ${formatIDR(p.amount)} · status ${p.status}.`);
      setWdAmount('');
      await refreshPayout();
    } catch (e: unknown) {
      // 409 nominal > available: tampilkan pesan server.
      setWdMsg(`Withdraw gagal: ${errMsg(e)}`);
    } finally {
      setWdBusy(false);
    }
  }

  /* ----- Aksi: dokumen legalitas (API-W01) ----- */
  async function submitDoc(e: React.FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    if (!token || !venue) {
      setDocMsg('Tidak ada token akses.');
      return;
    }
    if (!docUrl.trim()) {
      setDocMsg('Isi URL dokumen (path /uploads/… atau https).');
      return;
    }
    setDocBusy(true);
    setDocMsg(null);
    try {
      const d = await apiFetch<VenueDocument>(`/venues/${venue.id}/documents`, token, {
        method: 'POST',
        body: { type: docType, url: docUrl.trim() },
      });
      setDocMsg(`Dokumen ${d.type} tersimpan (status ${d.status}).`);
      setDocUrl('');
      await refreshVenue();
    } catch (e: unknown) {
      setDocMsg(`Upload gagal: ${errMsg(e)}`);
    } finally {
      setDocBusy(false);
    }
  }

  async function deleteDoc(docId: string) {
    const token = getAccessToken();
    if (!token || !venue) return;
    setDocBusy(true);
    try {
      await apiFetch<unknown>(`/venues/${venue.id}/documents/${docId}`, token, { method: 'DELETE' });
      setDocMsg('Dokumen dihapus.');
      await refreshVenue();
    } catch (e: unknown) {
      setDocMsg(`Hapus gagal: ${errMsg(e)}`);
    } finally {
      setDocBusy(false);
    }
  }

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

  const legalBadge = venue?.legalitas
    ? venue.legalitas === 'lengkap' ? '🏛 Legalitas lengkap'
      : venue.legalitas === 'parsial' ? '📄 Legalitas parsial'
        : '⚠️ Legalitas kosong'
    : null;

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
                  {legalBadge && <span className="ks-chip">{legalBadge}</span>}
                </div>
                <p className="ks-muted-text" style={{ fontSize: 13, margin: '6px 0 0' }}>
                  📍 {venue.address} · {courts.length} lapangan
                </p>
                <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 13, marginTop: 8 }}>
                  <input
                    type="checkbox"
                    checked={venue.status === 'approved'}
                    disabled
                    title="Toggle status butuh endpoint PATCH status venue owner — UpdateVenueDto saat ini tidak menerima field status, sehingga toggle dinonaktifkan agar tidak menipu"
                    aria-label="Status buka venue (dinonaktifkan, butuh endpoint baru)"
                  />
                  Status operasional (dinonaktifkan — butuh endpoint PATCH status)
                </label>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <a className="ks-btn ks-btn-primary ks-btn-sm" href="#walkin" aria-label="Ke formulir booking walk-in">
                  + Buat Booking Walk-in
                </a>
                <button
                  type="button"
                  className="ks-btn ks-btn-ghost ks-btn-sm"
                  onClick={() => scannerRef.current?.focus()}
                  title="Fokus ke kolom kode booking di stasiun check-in"
                >
                  Scan QR Tiket
                </button>
                <a className="ks-btn ks-btn-ghost ks-btn-sm" href="#payout" aria-label="Ke seksi payout dan withdraw">
                  Cairkan Payout
                </a>
              </div>
            </div>
          </section>

          {/* ---------- KPI real dari GET /venues/:id/stats?date= (API-W05) ---------- */}
          <div className="ks-grid ks-grid-4" style={{ marginTop: 16 }}>
            <div className="ks-card">
              <p className="label">📊 Okupansi slot ({prettyDate(dateISO)})</p>
              {vstats ? (
                <>
                  <p className="value sm">{vstats.occupancy.pct.toFixed(1)}%</p>
                  <p className="ks-muted-text" style={{ fontSize: 12, margin: '4px 0 0' }}>
                    Terisi {vstats.occupancy.bookedSlots} / {vstats.occupancy.totalSlots} slot · server (GET /venues/:id/stats).
                  </p>
                </>
              ) : (
                <>
                  <p className="value sm">—</p>
                  <p className="ks-muted-text" style={{ fontSize: 12, margin: '4px 0 0' }}>
                    {statsError ? `Gagal memuat: ${statsError}` : 'Memuat analitik venue…'}
                  </p>
                </>
              )}
            </div>
            <div className="ks-card">
              <p className="label">🎟️ Reservasi</p>
              {vstats ? (
                <>
                  <p className="value sm">{vstats.reservations.total} sesi</p>
                  <p className="ks-muted-text" style={{ fontSize: 12, margin: '4px 0 0' }}>
                    paid {vstats.reservations.byStatus.paid} · pending {vstats.reservations.byStatus.pending} · expired {vstats.reservations.byStatus.expired} · cancelled {vstats.reservations.byStatus.cancelled} (semua tanggal, server).
                  </p>
                </>
              ) : (
                <>
                  <p className="value sm">—</p>
                  <p className="ks-muted-text" style={{ fontSize: 12, margin: '4px 0 0' }}>
                    {statsError ? `Gagal memuat: ${statsError}` : 'Memuat analitik venue…'}
                  </p>
                </>
              )}
            </div>
            <div className="ks-card">
              <p className="label">💰 Pendapatan</p>
              {vstats ? (
                <>
                  <p className="value sm">{formatIDR(vstats.revenue.gmv)}</p>
                  <p className="ks-muted-text" style={{ fontSize: 12, margin: '4px 0 0' }}>
                    {vstats.revenue.paidCount} booking lunas · komisi {vstats.revenue.commissionPercent}% · bersih {formatIDR(vstats.revenue.net)} (server).
                  </p>
                </>
              ) : (
                <>
                  <p className="value sm">Belum tersedia</p>
                  <p className="ks-muted-text" style={{ fontSize: 12, margin: '4px 0 0' }}>
                    {statsError ? `Gagal memuat: ${statsError}` : 'Memuat analitik venue…'}
                  </p>
                </>
              )}
            </div>
            <div className="ks-card">
              <p className="label">⭐ Rating pemain</p>
              {vstats && vstats.rating.count > 0 && vstats.rating.avg !== null ? (
                <>
                  <p className="value sm">{vstats.rating.avg.toFixed(1)} / 5,0</p>
                  <p className="ks-muted-text" style={{ fontSize: 12, margin: '4px 0 0' }}>
                    {vstats.rating.count} ulasan (server).
                  </p>
                </>
              ) : vstats ? (
                <>
                  <p className="value sm">—</p>
                  <p className="ks-muted-text" style={{ fontSize: 12, margin: '4px 0 0' }}>
                    Belum ada ulasan.
                  </p>
                </>
              ) : (
                <>
                  <p className="value sm">—</p>
                  <p className="ks-muted-text" style={{ fontSize: 12, margin: '4px 0 0' }}>
                    {statsError ? `Gagal memuat: ${statsError}` : 'Memuat analitik venue…'}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* ---------- Top courts real (API-W05) ---------- */}
          <section className="ks-card" style={{ marginTop: 16 }} aria-labelledby="h-top">
            <h2 id="h-top" className="ks-panel-title">🏆 Lapangan Terlaris</h2>
            {!vstats ? (
              <p className="ks-muted-text" style={{ fontSize: 13, margin: 0 }}>
                {statsError ? `Gagal memuat: ${statsError}` : 'Memuat…'}
              </p>
            ) : vstats.topCourts.length === 0 ? (
              <EmptyState icon="🏟️" title="Belum ada booking lunas" desc="Belum ada court dengan booking paid di venue ini." />
            ) : (
              <div className="ks-table-wrap">
                <table className="ks-table">
                  <thead>
                    <tr>
                      <th scope="col">Lapangan</th>
                      <th scope="col">Booking lunas</th>
                      <th scope="col">GMV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vstats.topCourts.map((t) => (
                      <tr key={t.courtId}>
                        <td><strong>{disp(t.courtName)}</strong></td>
                        <td>{t.booked}</td>
                        <td>{formatIDR(t.gmv)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

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
              <span className="ks-badge open">free</span>{' '}
              <span className="ks-badge cancelled">blocked</span> — sel blocked
              dinonaktifkan (tanpa aksi).
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
                            const isBlocked = s.status === 'blocked';
                            return (
                              <td key={c.id}>
                                <button
                                  type="button"
                                  className={`ks-btn ks-btn-sm${active ? ' ks-btn-primary' : ' ks-btn-ghost'}`}
                                  onClick={() => setSelected({ courtId: c.id, startMinute: minute })}
                                  disabled={isBlocked}
                                  aria-pressed={active}
                                  aria-label={isBlocked
                                    ? `${c.name} ${s.start} sampai ${s.end}: diblokir, tanpa aksi`
                                    : `${c.name} ${s.start} sampai ${s.end}: ${s.status}`}
                                  title={isBlocked ? 'Slot diblokir (maintenance) — tanpa aksi' : 'Klik untuk info sel'}
                                >
                                  {s.status === 'free'
                                    ? `Tersedia · ${formatIDR(c.pricePerHour)}`
                                    : s.status === 'blocked' ? 'Diblokir' : s.status}
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
                  Informatif saja — gunakan formulir walk-in / blokir di bawah untuk aksi.
                </p>
              </div>
            )}
          </section>

          {/* ---------- Walk-in kasir (POST /bookings/walk-in, API-W06) ---------- */}
          <section className="ks-card" style={{ marginTop: 16 }} aria-labelledby="h-walkin" id="walkin">
            <h2 id="h-walkin" className="ks-panel-title">🧾 Booking Walk-in (Kasir)</h2>
            <p className="ks-muted-text" style={{ fontSize: 13, margin: '0 0 12px' }}>
              Catat pembayaran langsung tanggal {prettyDate(dateISO)} — booking langsung lunas (tanpa Midtrans).
            </p>
            <form onSubmit={submitWalkin} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <label style={{ flex: '1 1 160px', fontSize: 13 }}>
                Lapangan
                <select
                  className="ks-input"
                  style={{ marginTop: 4 }}
                  value={walkCourtId}
                  onChange={(e) => setWalkCourtId(e.target.value)}
                  aria-label="Lapangan walk-in"
                >
                  {courts.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} · {c.sport}</option>
                  ))}
                </select>
              </label>
              <label style={{ flex: '1 1 160px', fontSize: 13 }}>
                Nama pembeli
                <input
                  className="ks-input"
                  style={{ marginTop: 4 }}
                  value={walkBuyer}
                  onChange={(e) => setWalkBuyer(e.target.value)}
                  placeholder="Nama pembeli"
                  aria-label="Nama pembeli walk-in"
                  maxLength={120}
                />
              </label>
              <label style={{ flex: '0 1 120px', fontSize: 13 }}>
                Jam mulai
                <input
                  className="ks-input"
                  style={{ marginTop: 4 }}
                  value={walkStart}
                  onChange={(e) => setWalkStart(e.target.value)}
                  placeholder="HH:MM"
                  aria-label="Jam mulai walk-in (HH:MM)"
                />
              </label>
              <button className="ks-btn ks-btn-primary" type="submit" disabled={walkBusy} style={{ alignSelf: 'flex-end' }}>
                {walkBusy ? 'Menyimpan…' : 'Catat Walk-in'}
              </button>
            </form>
            {walkMsg && <p className="ks-muted-text" role="status" style={{ fontSize: 13, marginTop: 8 }}>{walkMsg}</p>}
          </section>

          {/* ---------- Blokir slot (POST/DELETE /courts/:id/blocks, API-W06) ---------- */}
          <section className="ks-card" style={{ marginTop: 16 }} aria-labelledby="h-block">
            <h2 id="h-block" className="ks-panel-title">🚧 Blokir Slot (Maintenance)</h2>
            <p className="ks-muted-text" style={{ fontSize: 13, margin: '0 0 12px' }}>
              Tutup slot bebas tanggal {prettyDate(dateISO)}. Slot terbooking tetap terbaca booked (klaim aktif menang atas blokir).
            </p>
            <form onSubmit={submitBlock} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <label style={{ flex: '1 1 160px', fontSize: 13 }}>
                Lapangan
                <select
                  className="ks-input"
                  style={{ marginTop: 4 }}
                  value={blockCourtId}
                  onChange={(e) => setBlockCourtId(e.target.value)}
                  aria-label="Lapangan yang diblokir"
                >
                  {courts.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} · {c.sport}</option>
                  ))}
                </select>
              </label>
              <label style={{ flex: '0 1 110px', fontSize: 13 }}>
                Jam mulai
                <input
                  className="ks-input"
                  style={{ marginTop: 4 }}
                  value={blockStart}
                  onChange={(e) => setBlockStart(e.target.value)}
                  placeholder="HH:MM"
                  aria-label="Jam mulai blokir (HH:MM)"
                />
              </label>
              <label style={{ flex: '0 1 110px', fontSize: 13 }}>
                Durasi (menit)
                <input
                  className="ks-input"
                  style={{ marginTop: 4 }}
                  value={blockDuration}
                  onChange={(e) => setBlockDuration(e.target.value)}
                  placeholder="60"
                  aria-label="Durasi blokir dalam menit"
                  inputMode="numeric"
                />
              </label>
              <label style={{ flex: '1 1 180px', fontSize: 13 }}>
                Alasan (opsional)
                <input
                  className="ks-input"
                  style={{ marginTop: 4 }}
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="Mis. perawatan lantai"
                  aria-label="Alasan blokir slot"
                  maxLength={255}
                />
              </label>
              <button className="ks-btn ks-btn-primary" type="submit" disabled={blockBusy} style={{ alignSelf: 'flex-end' }}>
                {blockBusy ? 'Menyimpan…' : 'Blokir Slot'}
              </button>
            </form>
            {blockMsg && <p className="ks-muted-text" role="status" style={{ fontSize: 13, marginTop: 8 }}>{blockMsg}</p>}
            <div style={{ marginTop: 12 }}>
              {courts.map((c) => {
                const items = blocks[c.id] ?? [];
                if (items.length === 0) return null;
                return (
                  <div key={c.id} style={{ marginBottom: 8 }}>
                    <p style={{ fontSize: 13, margin: '0 0 4px' }}><strong>{c.name}</strong> · {items.length} blokir tanggal {dateISO}</p>
                    <ul style={{ fontSize: 13, margin: 0, paddingLeft: 18 }}>
                      {items.map((b) => (
                        <li key={b.id}>
                          {b.start}–{b.end}{b.reason ? ` · ${b.reason}` : ''}{' '}
                          <button
                            type="button"
                            className="ks-btn ks-btn-ghost ks-btn-sm"
                            disabled={blockBusy}
                            onClick={() => void deleteBlock(c.id, b.id)}
                            aria-label={`Hapus blokir ${c.name} ${b.start} sampai ${b.end}`}
                          >
                            Hapus
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ---------- Stasiun check-in (API-W07) ---------- */}
          <section className="ks-card" style={{ marginTop: 16 }} aria-label="Validasi tiket dan check-in">
            <h2 className="ks-panel-title">🎫 Validasi Tiket &amp; Check-In Pemain</h2>
            <p className="ks-muted-text" style={{ fontSize: 13, margin: '0 0 12px' }}>
              Ketik kode booking (contoh: KS-88219) atau scan QR pemain.
            </p>
            <form onSubmit={lookupCode} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                ref={scannerRef}
                className="ks-input"
                style={{ flex: '1 1 240px' }}
                value={checkinCode}
                onChange={(e) => setCheckinCode(e.target.value)}
                placeholder="Ketik Kode Booking atau scan QR…"
                aria-label="Kode booking untuk check-in"
              />
              <button type="submit" className="ks-btn ks-btn-ghost" disabled={checkinBusy}>
                {checkinBusy ? 'Mencari…' : 'Cari'}
              </button>
              <button
                type="button"
                className="ks-btn ks-btn-primary"
                disabled={!foundBooking || checkinBusy || !!foundBooking.checkedInAt}
                onClick={() => void doCheckin()}
                aria-label="Validasi dan check-in booking ditemukan"
              >
                Validasi
              </button>
            </form>
            {checkinMsg && <p className="ks-muted-text" role="status" style={{ fontSize: 13, marginTop: 8 }}>{checkinMsg}</p>}
            {foundBooking && (
              <div className="ks-table-wrap" style={{ marginTop: 8 }}>
                <table className="ks-table">
                  <thead>
                    <tr>
                      <th scope="col">Kode</th>
                      <th scope="col">Tanggal</th>
                      <th scope="col">Status</th>
                      <th scope="col">Nominal</th>
                      <th scope="col">Check-in</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>{disp(foundBooking.code ?? checkinCode.trim())}</strong></td>
                      <td>{disp(foundBooking.date)}</td>
                      <td><StatusBadge status={foundBooking.status} /></td>
                      <td>{formatIDR(foundBooking.amount)}</td>
                      <td>{disp(foundBooking.checkedInAt ?? '—')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ---------- Payout & withdraw (API-W08) ---------- */}
          <section className="ks-card" style={{ marginTop: 16 }} aria-labelledby="h-payout" id="payout">
            <h2 id="h-payout" className="ks-panel-title">💸 Saldo & Withdraw Payout</h2>
            {balanceError && <p className="ks-error" role="alert">⚠️ {balanceError}</p>}
            {balance ? (
              <div className="ks-grid ks-grid-4" style={{ marginBottom: 12 }}>
                <div><p className="label">Gross (paid)</p><p className="value sm">{formatIDR(balance.gross)}</p></div>
                <div><p className="label">Net (komisi {balance.commissionPercent}%)</p><p className="value sm">{formatIDR(balance.net)}</p></div>
                <div><p className="label">Terkunci (approved+paid)</p><p className="value sm">{formatIDR(balance.reserved)}</p></div>
                <div><p className="label">Tersedia</p><p className="value sm">{formatIDR(balance.available)}</p></div>
              </div>
            ) : !balanceError && (
              <p className="ks-muted-text" style={{ fontSize: 13 }}>Memuat saldo payout…</p>
            )}
            <form onSubmit={submitWithdraw} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <label style={{ flex: '0 1 160px', fontSize: 13 }}>
                Nominal (Rp)
                <input
                  className="ks-input"
                  style={{ marginTop: 4 }}
                  value={wdAmount}
                  onChange={(e) => setWdAmount(e.target.value)}
                  placeholder="Mis. 500000"
                  aria-label="Nominal withdraw dalam rupiah"
                  inputMode="numeric"
                />
              </label>
              <label style={{ flex: '1 1 120px', fontSize: 13 }}>
                Bank (opsional)
                <input
                  className="ks-input"
                  style={{ marginTop: 4 }}
                  value={wdBank}
                  onChange={(e) => setWdBank(e.target.value)}
                  placeholder="Nama bank"
                  aria-label="Nama bank withdraw"
                />
              </label>
              <label style={{ flex: '1 1 140px', fontSize: 13 }}>
                No. rekening (opsional)
                <input
                  className="ks-input"
                  style={{ marginTop: 4 }}
                  value={wdNumber}
                  onChange={(e) => setWdNumber(e.target.value)}
                  placeholder="Nomor rekening"
                  aria-label="Nomor rekening withdraw"
                />
              </label>
              <label style={{ flex: '1 1 140px', fontSize: 13 }}>
                Nama pemilik (opsional)
                <input
                  className="ks-input"
                  style={{ marginTop: 4 }}
                  value={wdName}
                  onChange={(e) => setWdName(e.target.value)}
                  placeholder="Nama pemilik rekening"
                  aria-label="Nama pemilik rekening withdraw"
                />
              </label>
              <button className="ks-btn ks-btn-primary" type="submit" disabled={wdBusy} style={{ alignSelf: 'flex-end' }}>
                {wdBusy ? 'Mengirim…' : 'Request Withdraw'}
              </button>
            </form>
            {wdMsg && <p className="ks-muted-text" role="status" style={{ fontSize: 13, marginTop: 8 }}>{wdMsg}</p>}
            <h3 className="ks-panel-title" style={{ marginTop: 16 }}>Riwayat payout venue ini</h3>
            {payoutsError && <p className="ks-error" role="alert">⚠️ {payoutsError}</p>}
            {!payoutsError && payouts.length === 0 ? (
              <EmptyState icon="💸" title="Belum ada payout" desc="Belum ada request withdraw untuk venue ini." />
            ) : !payoutsError && (
              <div className="ks-table-wrap">
                <table className="ks-table">
                  <thead>
                    <tr>
                      <th scope="col">ID</th>
                      <th scope="col">Nominal</th>
                      <th scope="col">Status</th>
                      <th scope="col">Dibuat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.map((p) => (
                      <tr key={p.id}>
                        <td>{disp(p.id).slice(0, 8)}…</td>
                        <td>{formatIDR(p.amount)}</td>
                        <td><StatusBadge status={p.status} /></td>
                        <td>{disp(p.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ---------- Dokumen legalitas (API-W01) ---------- */}
          <section className="ks-card" style={{ marginTop: 16 }} aria-labelledby="h-docs">
            <div className="ks-sec-head">
              <div>
                <h2 id="h-docs" className="ks-panel-title">📑 Dokumen Legalitas</h2>
                <p className="ks-muted-text" style={{ fontSize: 13, margin: 0 }}>
                  {legalBadge ? `${legalBadge} — lengkap bila ≥ 2 dokumen terverifikasi.` : 'Status legalitas tidak tersedia.'}
                </p>
              </div>
            </div>
            {(venue.documents ?? []).length === 0 ? (
              <EmptyState icon="📑" title="Belum ada dokumen" desc="Belum ada dokumen legalitas untuk venue ini. Tambahkan via URL di bawah." />
            ) : (
              <div className="ks-table-wrap">
                <table className="ks-table">
                  <thead>
                    <tr>
                      <th scope="col">Tipe</th>
                      <th scope="col">URL</th>
                      <th scope="col">Status</th>
                      <th scope="col">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(venue.documents ?? []).map((d) => (
                      <tr key={d.id}>
                        <td><strong>{disp(d.type)}</strong></td>
                        <td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }}>{disp(d.url)}</td>
                        <td><StatusBadge status={d.status} /></td>
                        <td>
                          <button
                            type="button"
                            className="ks-btn ks-btn-ghost ks-btn-sm"
                            disabled={docBusy}
                            onClick={() => void deleteDoc(d.id)}
                            aria-label={`Hapus dokumen ${d.type}`}
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <form onSubmit={submitDoc} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              <label style={{ flex: '0 1 180px', fontSize: 13 }}>
                Tipe dokumen
                <select
                  className="ks-input"
                  style={{ marginTop: 4 }}
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  aria-label="Tipe dokumen legalitas"
                >
                  {DOC_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label style={{ flex: '1 1 240px', fontSize: 13 }}>
                URL dokumen
                <input
                  className="ks-input"
                  style={{ marginTop: 4 }}
                  value={docUrl}
                  onChange={(e) => setDocUrl(e.target.value)}
                  placeholder="/uploads/… atau https://…"
                  aria-label="URL dokumen legalitas"
                  spellCheck={false}
                />
              </label>
              <button className="ks-btn ks-btn-primary" type="submit" disabled={docBusy} style={{ alignSelf: 'flex-end' }}>
                {docBusy ? 'Menyimpan…' : 'Tambah Dokumen'}
              </button>
            </form>
            {docMsg && <p className="ks-muted-text" role="status" style={{ fontSize: 13, marginTop: 8 }}>{docMsg}</p>}
          </section>

          {/* Panel Rental & gear DISEMBUNYIKAN — belum ada endpoint inventaris rental. */}
          <section className="ks-card" style={{ marginTop: 16 }} aria-label="Rental dan gear">
            <h2 className="ks-panel-title">🎒 Rental &amp; Gear Add-On</h2>
            <p className="ks-muted-text" style={{ fontSize: 13, margin: 0 }}>
              Disembunyikan — belum ada endpoint inventaris rental,
              sehingga stok/unit tidak ditampilkan (tanpa angka palsu).
            </p>
          </section>
        </>
      )}
    </Shell>
  );
}
