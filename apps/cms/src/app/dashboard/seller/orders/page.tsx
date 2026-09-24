'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RoleGuard } from '@/components/RoleGuard';
import { SELLER_NAV, Shell } from '@/components/Shell';
import { EmptyState, StatusBadge, formatIDR } from '@/components/ui';
import { apiFetch, disp } from '@/lib/api';
import { getAccessToken, useAuth } from '@/lib/auth';

/* ---------- Tipe respons API (mirror server, lokal halaman) ---------- */

interface OrderItem {
  productId: string;
  productName: string;
  qty: number;
  price: number;
  subtotal: number;
}

interface SellerOrderGroup {
  groupId: string;
  orderId: string;
  paymentRef: string;
  status: string;
  subtotal: number;
  sellerShopName: string;
  items: OrderItem[];
  buyerDisplayName: string | null;
  paidAt: string | null;
  createdAt: string;
}

interface OrdersSellerRes {
  data: SellerOrderGroup[];
  meta: { page: number; limit: number; total: number };
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Terjadi kesalahan tak dikenal';
}

function is404(e: unknown): boolean {
  return e instanceof Error && e.message.includes('HTTP 404');
}

const PAGE_SIZE = 20;
const STATUS_FILTERS = ['semua', 'pending', 'paid', 'expired', 'cancelled'] as const;

export default function SellerOrdersPage() {
  return (
    <RoleGuard allowed={['seller', 'user']}>
      <OrdersContent />
    </RoleGuard>
  );
}

function OrdersContent() {
  const { me, logout } = useAuth();

  const [rows, setRows] = useState<SellerOrderGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('semua');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noStore, setNoStore] = useState(false);

  const refresh = useCallback(async (p: number) => {
    const token = getAccessToken();
    if (!token) {
      setError('Tidak ada token akses.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setNoStore(false);
    try {
      const r = await apiFetch<OrdersSellerRes>(`/orders/seller?page=${p}&limit=${PAGE_SIZE}`, token);
      setRows(r.data ?? []);
      setTotal(r.meta?.total ?? (r.data ?? []).length);
    } catch (e: unknown) {
      if (is404(e)) {
        // 404 jujur = akun belum punya profil seller.
        setNoStore(true);
        setRows([]);
        setTotal(0);
      } else {
        setError(errMsg(e));
        setRows([]);
        setTotal(0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh(page);
  }, [refresh, page]);

  // Filter status client-side atas halaman termuat (server tidak menyediakan filter).
  const visible = useMemo(
    () => (statusFilter === 'semua' ? rows : rows.filter((g) => g.status === statusFilter)),
    [rows, statusFilter],
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Shell
      me={me}
      onLogout={logout}
      nav={SELLER_NAV}
      title="Pesanan"
      subtitle="Grup order milik toko Anda (satu baris per grup seller + order induknya), terbaru dulu. Data real dari GET /orders/seller."
    >
      {error && (
        <p className="ks-error" role="alert">
          ⚠️ {error}{' '}
          <button className="ks-btn ks-btn-ghost ks-btn-sm" onClick={() => void refresh(page)}>Muat ulang</button>
        </p>
      )}

      {noStore && (
        <EmptyState
          icon="🛍️"
          title="Belum punya toko"
          desc="Akun ini belum memiliki profil seller (GET /orders/seller → 404). Daftarkan toko dulu untuk menerima pesanan."
          action={<a className="ks-btn ks-btn-primary ks-btn-sm" href="/dashboard/seller">Daftar toko →</a>}
        />
      )}

      {!noStore && loading && <p className="ks-muted-text">Memuat pesanan…</p>}

      {!noStore && !loading && !error && rows.length === 0 && (
        <EmptyState
          icon="🧾"
          title="Belum ada pesanan"
          desc="Toko Anda belum menerima order. Pesanan dari checkout pembeli akan muncul di sini setelah produk disetujui dan dibeli."
        />
      )}

      {!noStore && !loading && !error && rows.length > 0 && (
        <section className="ks-card" aria-label="Daftar pesanan">
          <section className="ks-toolbar">
            <label>
              Status:{' '}
              <select
                className="ks-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                aria-label="Filter status pesanan (halaman ini)"
              >
                {STATUS_FILTERS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <button className="ks-btn ks-btn-ghost ks-btn-sm" onClick={() => void refresh(page)} disabled={loading}>
              🔄 Muat ulang
            </button>
            <span className="ks-total">Total: {total} grup</span>
          </section>
          <p className="ks-muted-text" style={{ fontSize: 12, margin: '0 0 8px' }}>
            Filter status hanya menyaring {rows.length} grup pada halaman {page} ini
            (server tidak menyediakan filter status).
          </p>

          {visible.length === 0 ? (
            <EmptyState
              icon="🔍"
              title="Tidak ada hasil filter"
              desc={`Tidak ada grup berstatus "${statusFilter}" pada halaman ini. Ubah filter atau pindah halaman.`}
            />
          ) : (
            <div className="ks-table-wrap">
              <table className="ks-table">
                <thead>
                  <tr>
                    <th scope="col">Order / Ref</th>
                    <th scope="col">Pembeli</th>
                    <th scope="col">Item</th>
                    <th scope="col">Subtotal</th>
                    <th scope="col">Status</th>
                    <th scope="col">Dibayar</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((g) => (
                    <tr key={g.groupId}>
                      <td>
                        <strong>{disp(g.paymentRef)}</strong>
                        <div className="ks-muted-text" style={{ fontSize: 12 }}>
                          order {disp(g.orderId).slice(0, 8)}… · {new Date(g.createdAt).toLocaleString('id-ID')}
                        </div>
                      </td>
                      {/* Hanya displayName — email/telepon buyer tidak diekspos server. */}
                      <td>{g.buyerDisplayName ? disp(g.buyerDisplayName) : '—'}</td>
                      <td>
                        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13 }}>
                          {(g.items ?? []).map((it) => (
                            <li key={it.productId}>
                              {disp(it.productName)} × {it.qty} · {formatIDR(it.price)}
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td>{formatIDR(g.subtotal)}</td>
                      <td><StatusBadge status={g.status} /></td>
                      <td>{g.paidAt ? new Date(g.paidAt).toLocaleString('id-ID') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              type="button"
              className="ks-btn ks-btn-ghost ks-btn-sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Sebelumnya
            </button>
            <span className="ks-muted-text" style={{ fontSize: 13, alignSelf: 'center' }}>
              Halaman {page} dari {totalPages}
            </span>
            <button
              type="button"
              className="ks-btn ks-btn-ghost ks-btn-sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Berikutnya →
            </button>
          </div>
        </section>
      )}
    </Shell>
  );
}
