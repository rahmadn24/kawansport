'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RoleGuard } from '@/components/RoleGuard';
import { SELLER_NAV, Shell } from '@/components/Shell';
import { EmptyState, StatusBadge, formatIDR } from '@/components/ui';
import { apiFetch, disp } from '@/lib/api';
import { getAccessToken, useAuth } from '@/lib/auth';

/* ---------- Tipe respons API (mirror server, lokal halaman) ---------- */

interface SellerItem {
  id: string;
  owner: { id: string; email: string; displayName: string | null };
  shopName: string;
  description: string | null;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ProductItem {
  id: string;
  name: string;
  price: number;
  stock: number;
  status: string;
}

interface ProductsMineRes {
  data: ProductItem[];
  meta: { page: number; limit: number; total: number };
}

interface SellerOrderGroup {
  groupId: string;
  orderId: string;
  paymentRef: string;
  status: string;
  subtotal: number;
  paidAt: string | null;
  createdAt: string;
}

interface OrdersSellerRes {
  data: SellerOrderGroup[];
  meta: { page: number; limit: number; total: number };
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

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Terjadi kesalahan tak dikenal';
}

function is404(e: unknown): boolean {
  return e instanceof Error && e.message.includes('HTTP 404');
}

/**
 * Hub dashboard seller (MP-01/MP-02 + API-W08).
 * Guard meloloskan `seller`, `user` (agar akun tanpa toko bisa daftar —
 * role baru selalu `user` sampai admin approve), dan `super_admin`
 * (otomatis via RoleGuard, mode read-only).
 */
export default function SellerDashboard() {
  return (
    <RoleGuard allowed={['seller', 'user']}>
      <SellerHub />
    </RoleGuard>
  );
}

function SellerHub() {
  const { me, logout } = useAuth();
  const readOnly = me?.role === 'super_admin';

  const [seller, setSeller] = useState<SellerItem | null>(null);
  const [phase, setPhase] = useState<'loading' | 'missing' | 'ready'>('loading');
  const [sellerError, setSellerError] = useState<string | null>(null);

  // Form daftar toko (POST /sellers — CreateSellerDto: shopName, description?).
  const [regName, setRegName] = useState('');
  const [regDesc, setRegDesc] = useState('');
  const [regBusy, setRegBusy] = useState(false);
  const [regMsg, setRegMsg] = useState<string | null>(null);

  // Form edit profil (PATCH /sellers/me — UpdateSellerDto).
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [editMsg, setEditMsg] = useState<string | null>(null);

  // KPI ringkas.
  const [prodTotal, setProdTotal] = useState<number | null>(null);
  const [prodByStatus, setProdByStatus] = useState<Record<string, number>>({});
  const [prodError, setProdError] = useState<string | null>(null);
  const [orderTotal, setOrderTotal] = useState<number | null>(null);
  const [orderLoaded, setOrderLoaded] = useState(0);
  const [paidCount, setPaidCount] = useState(0);
  const [paidGmv, setPaidGmv] = useState(0);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [balance, setBalance] = useState<BalanceRes | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  const refreshSeller = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setSellerError('Tidak ada token akses.');
      setPhase('missing');
      return;
    }
    setPhase('loading');
    setSellerError(null);
    try {
      const s = await apiFetch<SellerItem>('/sellers/me', token);
      setSeller(s);
      setEditName(s.shopName);
      setEditDesc(s.description ?? '');
      setPhase('ready');
    } catch (e: unknown) {
      if (is404(e)) {
        // 404 jujur dari server = belum punya toko → tampilkan form daftar.
        setSeller(null);
        setPhase('missing');
      } else {
        setSellerError(errMsg(e));
        setPhase('missing');
      }
    }
  }, []);

  useEffect(() => {
    void refreshSeller();
  }, [refreshSeller]);

  // KPI dimuat setelah profil toko ada (butuh seller.id untuk saldo).
  useEffect(() => {
    if (phase !== 'ready' || !seller) return;
    const token = getAccessToken();
    if (!token) return;
    let cancelled = false;

    apiFetch<ProductsMineRes>('/products/mine?page=1&limit=50', token)
      .then((r) => {
        if (cancelled) return;
        const counts: Record<string, number> = {};
        for (const p of r.data ?? []) counts[p.status] = (counts[p.status] ?? 0) + 1;
        setProdByStatus(counts);
        setProdTotal(r.meta?.total ?? (r.data ?? []).length);
        setProdError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setProdError(errMsg(e));
        setProdTotal(null);
      });

    apiFetch<OrdersSellerRes>('/orders/seller?page=1&limit=50', token)
      .then((r) => {
        if (cancelled) return;
        const rows = r.data ?? [];
        setOrderTotal(r.meta?.total ?? rows.length);
        setOrderLoaded(rows.length);
        setPaidCount(rows.filter((g) => g.status === 'paid').length);
        setPaidGmv(rows.filter((g) => g.status === 'paid').reduce((a, g) => a + g.subtotal, 0));
        setOrderError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setOrderError(errMsg(e));
        setOrderTotal(null);
      });

    apiFetch<BalanceRes>(
      `/payouts/balance?payeeType=seller&payeeId=${seller.id}`,
      token,
    )
      .then((b) => {
        if (cancelled) return;
        setBalance(b);
        setBalanceError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setBalanceError(errMsg(e));
        setBalance(null);
      });

    return () => {
      cancelled = true;
    };
  }, [phase, seller]);

  async function submitRegister(e: React.FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    if (!token) {
      setRegMsg('Tidak ada token akses.');
      return;
    }
    if (!regName.trim()) {
      setRegMsg('Nama toko wajib diisi (maks 120 karakter).');
      return;
    }
    setRegBusy(true);
    setRegMsg(null);
    try {
      const body: Record<string, unknown> = { shopName: regName.trim() };
      if (regDesc.trim()) body['description'] = regDesc.trim();
      const s = await apiFetch<SellerItem>('/sellers', token, { method: 'POST', body });
      setRegMsg(`Pendaftaran terkirim — toko "${s.shopName}" berstatus ${s.status}. Tunggu approval super_admin.`);
      setRegName('');
      setRegDesc('');
      await refreshSeller();
    } catch (e: unknown) {
      // 409 = sudah punya profil (mis. klik ganda) — arahkan muat ulang.
      setRegMsg(`Pendaftaran gagal: ${errMsg(e)}`);
    } finally {
      setRegBusy(false);
    }
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    if (!token) {
      setEditMsg('Tidak ada token akses.');
      return;
    }
    setEditBusy(true);
    setEditMsg(null);
    try {
      const s = await apiFetch<SellerItem>('/sellers/me', token, {
        method: 'PATCH',
        body: { shopName: editName.trim(), description: editDesc.trim() || null },
      });
      setSeller(s);
      setEditMsg(`Profil toko tersimpan (status tetap ${s.status}).`);
    } catch (e: unknown) {
      setEditMsg(`Simpan gagal: ${errMsg(e)}`);
    } finally {
      setEditBusy(false);
    }
  }

  return (
    <Shell
      me={me}
      onLogout={logout}
      nav={SELLER_NAV}
      title="Overview Toko"
      subtitle="Profil toko, ringkasan produk & pesanan, dan saldo payout Anda."
    >
      {readOnly && (
        <p className="ks-muted-text" role="note" style={{ fontSize: 13, marginBottom: 12 }}>
          👁️ Anda login sebagai super_admin — halaman ini read-only untuk Anda; formulir dinonaktifkan.
        </p>
      )}

      {phase === 'loading' && <p className="ks-muted-text">Memuat profil toko…</p>}

      {phase === 'missing' && !sellerError && !readOnly && (
        <section className="ks-card" aria-labelledby="h-register">
          <h2 id="h-register" className="ks-panel-title">🛍️ Daftarkan Toko Anda</h2>
          <p className="ks-muted-text" style={{ fontSize: 13, margin: '0 0 12px' }}>
            Akun ini belum memiliki toko (GET /sellers/me → 404). Isi form di bawah —
            toko dibuat berstatus <code>pending</code> dan role tetap <code>user</code> sampai super_admin menyetujui.
          </p>
          <form onSubmit={submitRegister} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <label style={{ flex: '1 1 200px', fontSize: 13 }}>
              Nama toko (wajib, maks 120)
              <input
                className="ks-input"
                style={{ marginTop: 4 }}
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="Mis. Toko Bola Maju"
                aria-label="Nama toko"
                maxLength={120}
              />
            </label>
            <label style={{ flex: '2 1 280px', fontSize: 13 }}>
              Deskripsi (opsional, maks 2000)
              <textarea
                className="ks-input"
                style={{ marginTop: 4 }}
                value={regDesc}
                onChange={(e) => setRegDesc(e.target.value)}
                placeholder="Ceritakan toko Anda…"
                aria-label="Deskripsi toko"
                maxLength={2000}
                rows={2}
              />
            </label>
            <button className="ks-btn ks-btn-primary" type="submit" disabled={regBusy} style={{ alignSelf: 'flex-end' }}>
              {regBusy ? 'Mengirim…' : 'Daftar Toko'}
            </button>
          </form>
          {regMsg && <p className="ks-muted-text" role="status" style={{ fontSize: 13, marginTop: 8 }}>{regMsg}</p>}
        </section>
      )}

      {phase === 'missing' && !sellerError && readOnly && (
        <EmptyState
          icon="🛍️"
          title="Akun ini belum punya toko"
          desc="GET /sellers/me mengembalikan 404 untuk akun ini. Login sebagai akun seller/user untuk mendaftar toko."
        />
      )}

      {sellerError && (
        <p className="ks-error" role="alert">
          ⚠️ Gagal memuat profil toko: {sellerError}{' '}
          <button className="ks-btn ks-btn-ghost ks-btn-sm" onClick={() => void refreshSeller()}>Muat ulang</button>
        </p>
      )}

      {phase === 'ready' && seller && (
        <>
          {/* ---------- Status toko ---------- */}
          <section className="ks-card" aria-label="Status toko">
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: '1 1 240px' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontSize: 20 }}>{seller.shopName}</h2>
                  <StatusBadge status={seller.status} />
                </div>
                <p className="ks-muted-text" style={{ fontSize: 13, margin: '6px 0 0' }}>
                  {seller.description || 'Belum ada deskripsi toko.'}
                </p>
                {seller.status === 'rejected' && seller.rejectionReason && (
                  <p className="ks-error" role="alert" style={{ fontSize: 13, marginTop: 8 }}>
                    Pengajuan ditolak: {disp(seller.rejectionReason)}. Perbaiki profil lalu hubungi super_admin untuk pengajuan ulang.
                  </p>
                )}
                {seller.status === 'pending' && (
                  <p className="ks-muted-text" style={{ fontSize: 13, marginTop: 8 }}>
                    ⏳ Menunggu approval super_admin — produk baru belum bisa dibuat sampai toko disetujui.
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Link className="ks-btn ks-btn-primary ks-btn-sm" href="/dashboard/seller/products">📦 Kelola produk →</Link>
                <Link className="ks-btn ks-btn-ghost ks-btn-sm" href="/dashboard/seller/orders">🧾 Lihat pesanan →</Link>
              </div>
            </div>
          </section>

          {/* ---------- KPI ringkas ---------- */}
          <div className="ks-grid ks-grid-4" style={{ marginTop: 16 }}>
            <div className="ks-card">
              <p className="label">📦 Total produk</p>
              {prodTotal === null ? (
                <p className="ks-muted-text" style={{ fontSize: 12 }}>{prodError ? `Gagal: ${prodError}` : 'Memuat…'}</p>
              ) : (
                <>
                  <p className="value sm">{prodTotal}</p>
                  <p className="ks-muted-text" style={{ fontSize: 12, margin: '4px 0 0' }}>
                    approved {prodByStatus['approved'] ?? 0} · pending {prodByStatus['pending'] ?? 0} · rejected {prodByStatus['rejected'] ?? 0} (GET /products/mine).
                  </p>
                </>
              )}
            </div>
            <div className="ks-card">
              <p className="label">🧾 Grup pesanan</p>
              {orderTotal === null ? (
                <p className="ks-muted-text" style={{ fontSize: 12 }}>{orderError ? `Gagal: ${orderError}` : 'Memuat…'}</p>
              ) : (
                <>
                  <p className="value sm">{orderTotal}</p>
                  <p className="ks-muted-text" style={{ fontSize: 12, margin: '4px 0 0' }}>
                    {paidCount} lunas dari {orderLoaded} grup termuat (GET /orders/seller).
                  </p>
                </>
              )}
            </div>
            <div className="ks-card">
              <p className="label">💰 Estimasi omzet lunas</p>
              {orderTotal === null ? (
                <p className="ks-muted-text" style={{ fontSize: 12 }}>{orderError ? `Gagal: ${orderError}` : 'Memuat…'}</p>
              ) : (
                <>
                  <p className="value sm">{formatIDR(paidGmv)}</p>
                  <p className="ks-muted-text" style={{ fontSize: 12, margin: '4px 0 0' }}>
                    Subtotal grup berstatus paid (halaman termuat; sebelum komisi & payout).
                  </p>
                </>
              )}
            </div>
            <div className="ks-card">
              <p className="label">💸 Saldo tersedia</p>
              {!balance ? (
                <p className="ks-muted-text" style={{ fontSize: 12 }}>{balanceError ? `Gagal: ${balanceError}` : 'Memuat…'}</p>
              ) : (
                <>
                  <p className="value sm">{formatIDR(balance.available)}</p>
                  <p className="ks-muted-text" style={{ fontSize: 12, margin: '4px 0 0' }}>
                    Net {formatIDR(balance.net)} (komisi {balance.commissionPercent}%) · terkunci {formatIDR(balance.reserved)}.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* ---------- Edit profil toko ---------- */}
          {!readOnly && (
            <section className="ks-card" style={{ marginTop: 16 }} aria-labelledby="h-edit">
              <h2 id="h-edit" className="ks-panel-title">⚙️ Edit Profil Toko</h2>
              <p className="ks-muted-text" style={{ fontSize: 13, margin: '0 0 12px' }}>
                PATCH /sellers/me — status toko tidak berubah saat profil diubah.
              </p>
              <form onSubmit={submitEdit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <label style={{ flex: '1 1 200px', fontSize: 13 }}>
                  Nama toko
                  <input
                    className="ks-input"
                    style={{ marginTop: 4 }}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    aria-label="Nama toko"
                    maxLength={120}
                  />
                </label>
                <label style={{ flex: '2 1 280px', fontSize: 13 }}>
                  Deskripsi
                  <textarea
                    className="ks-input"
                    style={{ marginTop: 4 }}
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    aria-label="Deskripsi toko"
                    maxLength={2000}
                    rows={2}
                  />
                </label>
                <button className="ks-btn ks-btn-primary" type="submit" disabled={editBusy} style={{ alignSelf: 'flex-end' }}>
                  {editBusy ? 'Menyimpan…' : 'Simpan Profil'}
                </button>
              </form>
              {editMsg && <p className="ks-muted-text" role="status" style={{ fontSize: 13, marginTop: 8 }}>{editMsg}</p>}
            </section>
          )}
        </>
      )}
    </Shell>
  );
}
