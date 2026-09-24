'use client';

import { useCallback, useEffect, useState } from 'react';
import { RoleGuard } from '@/components/RoleGuard';
import { SELLER_NAV, Shell } from '@/components/Shell';
import { EmptyState, StatusBadge, formatIDR } from '@/components/ui';
import { apiFetch, disp } from '@/lib/api';
import { getAccessToken, useAuth } from '@/lib/auth';

/* ---------- Tipe respons API (mirror server, lokal halaman — pola owner payout) ---------- */

interface SellerItem {
  id: string;
  shopName: string;
  status: string;
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

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Terjadi kesalahan tak dikenal';
}

function is404(e: unknown): boolean {
  return e instanceof Error && e.message.includes('HTTP 404');
}

export default function SellerPayoutsPage() {
  return (
    <RoleGuard allowed={['seller', 'user']}>
      <PayoutsContent />
    </RoleGuard>
  );
}

function PayoutsContent() {
  const { me, logout } = useAuth();
  const readOnly = me?.role === 'super_admin';

  const [seller, setSeller] = useState<SellerItem | null>(null);
  const [loadingSeller, setLoadingSeller] = useState(true);
  const [sellerError, setSellerError] = useState<string | null>(null);
  const [noStore, setNoStore] = useState(false);

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

  const refreshPayout = useCallback(async (sellerId: string) => {
    const token = getAccessToken();
    if (!token) return;
    setBalanceError(null);
    setPayoutsError(null);
    try {
      setBalance(await apiFetch<BalanceRes>(
        `/payouts/balance?payeeType=seller&payeeId=${sellerId}`,
        token,
      ));
    } catch (e: unknown) {
      setBalanceError(errMsg(e));
      setBalance(null);
    }
    try {
      const r = await apiFetch<PayoutsMeRes>('/payouts/me', token);
      setPayouts((r.data ?? []).filter((p) => p.payeeId === sellerId));
    } catch (e: unknown) {
      setPayoutsError(errMsg(e));
      setPayouts([]);
    }
  }, []);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setSellerError('Tidak ada token akses.');
      setLoadingSeller(false);
      return;
    }
    apiFetch<SellerItem>('/sellers/me', token)
      .then((s) => {
        setSeller(s);
        setNoStore(false);
        void refreshPayout(s.id);
      })
      .catch((e: unknown) => {
        if (is404(e)) {
          setNoStore(true);
        } else {
          setSellerError(errMsg(e));
        }
      })
      .finally(() => setLoadingSeller(false));
  }, [refreshPayout]);

  async function submitWithdraw(e: React.FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    if (!token || !seller) {
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
      const body: Record<string, unknown> = { payeeType: 'seller', payeeId: seller.id, amount };
      if (wdBank.trim()) body['bankName'] = wdBank.trim();
      if (wdNumber.trim()) body['accountNumber'] = wdNumber.trim();
      if (wdName.trim()) body['accountName'] = wdName.trim();
      const p = await apiFetch<PayoutItem>('/payouts', token, { method: 'POST', body });
      setWdMsg(`Request withdraw tercatat: ${p.id} · ${formatIDR(p.amount)} · status ${p.status}. Menunggu persetujuan super_admin.`);
      setWdAmount('');
      await refreshPayout(seller.id);
    } catch (e: unknown) {
      // 409 = nominal melebihi saldo tersedia; 403 = lintas owner.
      setWdMsg(`Withdraw gagal: ${errMsg(e)}`);
    } finally {
      setWdBusy(false);
    }
  }

  return (
    <Shell
      me={me}
      onLogout={logout}
      nav={SELLER_NAV}
      title="Saldo & Payout"
      subtitle="Saldo live dari order grup paid (setelah komisi) dikurangi payout yang sudah disetujui/dibayar. Data real dari GET /payouts/balance."
    >
      {readOnly && (
        <p className="ks-muted-text" role="note" style={{ fontSize: 13, marginBottom: 12 }}>
          👁️ Anda login sebagai super_admin — halaman ini read-only untuk Anda; formulir dinonaktifkan.
        </p>
      )}

      {loadingSeller && <p className="ks-muted-text">Memuat profil toko…</p>}

      {sellerError && (
        <p className="ks-error" role="alert">⚠️ Gagal memuat profil toko: {sellerError}</p>
      )}

      {noStore && (
        <EmptyState
          icon="🛍️"
          title="Belum punya toko"
          desc="Akun ini belum memiliki profil seller (GET /sellers/me → 404) sehingga saldo tidak bisa dihitung. Daftarkan toko dulu."
          action={<a className="ks-btn ks-btn-primary ks-btn-sm" href="/dashboard/seller">Daftar toko →</a>}
        />
      )}

      {seller && (
        <section className="ks-card" aria-labelledby="h-payout">
          <h2 id="h-payout" className="ks-panel-title">
            💸 Saldo toko “{seller.shopName}” <StatusBadge status={seller.status} />
          </h2>
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

          {!readOnly && (
            <>
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
            </>
          )}

          <h3 className="ks-panel-title" style={{ marginTop: 16 }}>Riwayat payout toko ini</h3>
          {payoutsError && <p className="ks-error" role="alert">⚠️ {payoutsError}</p>}
          {!payoutsError && payouts.length === 0 ? (
            <EmptyState icon="💸" title="Belum ada payout" desc="Belum ada request withdraw untuk toko ini." />
          ) : !payoutsError && (
            <div className="ks-table-wrap">
              <table className="ks-table">
                <thead>
                  <tr>
                    <th scope="col">ID</th>
                    <th scope="col">Nominal</th>
                    <th scope="col">Bank / Rekening</th>
                    <th scope="col">Status</th>
                    <th scope="col">Keterangan</th>
                    <th scope="col">Dibuat</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((p) => (
                    <tr key={p.id}>
                      <td>{disp(p.id).slice(0, 8)}…</td>
                      <td>{formatIDR(p.amount)}</td>
                      <td>{[p.bankName, p.accountNumber, p.accountName].filter(Boolean).join(' · ') || '—'}</td>
                      <td><StatusBadge status={p.status} /></td>
                      <td>{p.status === 'rejected' ? disp(p.reason ?? '—') : disp(p.reference ?? '—')}</td>
                      <td>{new Date(p.createdAt).toLocaleString('id-ID')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </Shell>
  );
}
