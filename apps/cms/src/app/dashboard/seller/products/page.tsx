'use client';

import { useCallback, useEffect, useState } from 'react';
import { RoleGuard } from '@/components/RoleGuard';
import { SELLER_NAV, Shell } from '@/components/Shell';
import { EmptyState, StatusBadge, formatIDR } from '@/components/ui';
import { apiFetch, disp } from '@/lib/api';
import { getAccessToken, useAuth } from '@/lib/auth';

/* ---------- Tipe respons API (mirror server, lokal halaman) ---------- */

interface ProductItem {
  id: string;
  seller: { id: string; shopName: string; ownerId: string };
  category: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  photos: string[];
  status: string;
  rejectionReason: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ProductsMineRes {
  data: ProductItem[];
  meta: { page: number; limit: number; total: number };
}

/** Badan 202 AD-02: edit sensitif atas produk approved → change request. */
interface PendingChangeRes {
  pendingReview: boolean;
  changeRequestId: string;
  entityType: string;
  entityId: string;
  status: string;
  message?: string;
}

function isPendingChange(v: unknown): v is PendingChangeRes {
  return (
    typeof v === 'object' && v !== null &&
    (v as Record<string, unknown>)['pendingReview'] === true
  );
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Terjadi kesalahan tak dikenal';
}

function is404(e: unknown): boolean {
  return e instanceof Error && e.message.includes('HTTP 404');
}

const PAGE_SIZE = 20;

export default function SellerProductsPage() {
  return (
    <RoleGuard allowed={['seller', 'user']}>
      <ProductsContent />
    </RoleGuard>
  );
}

function ProductsContent() {
  const { me, logout } = useAuth();
  const readOnly = me?.role === 'super_admin';

  const [rows, setRows] = useState<ProductItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noStore, setNoStore] = useState(false);

  // Form tambah produk (POST /products — CreateProductDto).
  const [fName, setFName] = useState('');
  const [fCategory, setFCategory] = useState('');
  const [fPrice, setFPrice] = useState('');
  const [fStock, setFStock] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fPhotos, setFPhotos] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [addMsg, setAddMsg] = useState<string | null>(null);

  // Form edit inline (PATCH /products/:id — UpdateProductDto).
  const [editId, setEditId] = useState<string | null>(null);
  const [eName, setEName] = useState('');
  const [eCategory, setECategory] = useState('');
  const [ePrice, setEPrice] = useState('');
  const [eStock, setEStock] = useState('');
  const [eDesc, setEDesc] = useState('');
  const [ePhotos, setEPhotos] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [editMsg, setEditMsg] = useState<string | null>(null);

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
      const r = await apiFetch<ProductsMineRes>(`/products/mine?page=${p}&limit=${PAGE_SIZE}`, token);
      setRows(r.data ?? []);
      setTotal(r.meta?.total ?? (r.data ?? []).length);
    } catch (e: unknown) {
      if (is404(e)) {
        // 404 jujur = akun belum punya profil toko → arahkan daftar dulu.
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

  /** Foto: satu URL per baris (maks 5; hanya path /uploads/… atau https). */
  function parsePhotos(raw: string): string[] {
    return raw.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 5);
  }

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    if (!token) {
      setAddMsg('Tidak ada token akses.');
      return;
    }
    const price = Number(fPrice);
    const stock = Number(fStock);
    if (!fName.trim() || !fCategory.trim()) {
      setAddMsg('Nama produk dan kategori wajib diisi.');
      return;
    }
    if (!Number.isInteger(price) || price < 0 || !Number.isInteger(stock) || stock < 0) {
      setAddMsg('Harga dan stok harus bilangan bulat ≥ 0.');
      return;
    }
    setAddBusy(true);
    setAddMsg(null);
    try {
      const body: Record<string, unknown> = {
        name: fName.trim(),
        category: fCategory.trim(),
        price,
        stock,
      };
      if (fDesc.trim()) body['description'] = fDesc.trim();
      const photos = parsePhotos(fPhotos);
      if (photos.length > 0) body['photos'] = photos;
      const p = await apiFetch<ProductItem>('/products', token, { method: 'POST', body });
      setAddMsg(`Produk "${p.name}" tersimpan berstatus ${p.status} — menunggu approval super_admin.`);
      setFName(''); setFCategory(''); setFPrice(''); setFStock(''); setFDesc(''); setFPhotos('');
      setPage(1);
      await refresh(1);
    } catch (e: unknown) {
      // 403 = toko belum approved; 400 = validasi (mis. URL foto ilegal).
      setAddMsg(`Tambah produk gagal: ${errMsg(e)}`);
    } finally {
      setAddBusy(false);
    }
  }

  function startEdit(p: ProductItem) {
    setEditId(p.id);
    setEName(p.name);
    setECategory(p.category);
    setEPrice(String(p.price));
    setEStock(String(p.stock));
    setEDesc(p.description ?? '');
    setEPhotos((p.photos ?? []).join('\n'));
    setEditMsg(null);
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    if (!token || !editId) return;
    const price = Number(ePrice);
    const stock = Number(eStock);
    if (!Number.isInteger(price) || price < 0 || !Number.isInteger(stock) || stock < 0) {
      setEditMsg('Harga dan stok harus bilangan bulat ≥ 0.');
      return;
    }
    setEditBusy(true);
    setEditMsg(null);
    try {
      const body: Record<string, unknown> = {
        name: eName.trim(),
        category: eCategory.trim(),
        price,
        stock,
        description: eDesc.trim() || null,
        photos: parsePhotos(ePhotos),
      };
      const res = await apiFetch<ProductItem | PendingChangeRes>(`/products/${editId}`, token, {
        method: 'PATCH',
        body,
      });
      if (isPendingChange(res)) {
        // AD-02 jujur: field sensitif atas produk approved → 202 change request.
        setEditMsg(
          `Perubahan sensitif diteruskan sebagai pengajuan review (202): change request ${res.changeRequestId} ` +
          `berstatus ${res.status}. Data publik tetap versi lama sampai admin menyetujui. ${res.message ?? ''}`,
        );
      } else {
        const wasRejected = rows.find((r) => r.id === editId)?.status === 'rejected';
        setEditMsg(
          wasRejected
            ? `Perubahan tersimpan — produk kembali berstatus ${res.status} (pengajuan ulang).`
            : `Perubahan tersimpan (status ${res.status}).`,
        );
      }
      setEditId(null);
      await refresh(page);
    } catch (e: unknown) {
      setEditMsg(`Simpan gagal: ${errMsg(e)}`);
    } finally {
      setEditBusy(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Shell
      me={me}
      onLogout={logout}
      nav={SELLER_NAV}
      title="Produk Saya"
      subtitle="Semua produk toko Anda — semua status (pending/approved/rejected), terbaru dulu. Data real dari GET /products/mine."
    >
      {readOnly && (
        <p className="ks-muted-text" role="note" style={{ fontSize: 13, marginBottom: 12 }}>
          👁️ Anda login sebagai super_admin — halaman ini read-only untuk Anda; formulir dinonaktifkan.
        </p>
      )}

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
          desc="Akun ini belum memiliki profil seller (GET /products/mine → 404). Daftarkan toko dulu sebelum mengelola produk."
          action={<a className="ks-btn ks-btn-primary ks-btn-sm" href="/dashboard/seller">Daftar toko →</a>}
        />
      )}

      {!noStore && loading && <p className="ks-muted-text">Memuat produk…</p>}

      {!noStore && !loading && !error && rows.length === 0 && (
        <EmptyState
          icon="📦"
          title="Belum ada produk"
          desc="Toko Anda belum memiliki produk. Tambahkan produk pertama lewat formulir di bawah — produk baru berstatus pending sampai disetujui super_admin."
        />
      )}

      {!noStore && rows.length > 0 && (
        <section className="ks-card" aria-label="Daftar produk">
          <div className="ks-sec-head">
            <p className="ks-muted-text" style={{ fontSize: 13, margin: 0 }}>
              Total {total} produk · halaman {page} dari {totalPages}.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="ks-btn ks-btn-ghost ks-btn-sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Sebelumnya
              </button>
              <button
                type="button"
                className="ks-btn ks-btn-ghost ks-btn-sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Berikutnya →
              </button>
            </div>
          </div>
          <div className="ks-table-wrap">
            <table className="ks-table">
              <thead>
                <tr>
                  <th scope="col">Nama</th>
                  <th scope="col">Kategori</th>
                  <th scope="col">Harga</th>
                  <th scope="col">Stok</th>
                  <th scope="col">Status</th>
                  <th scope="col">Alasan reject</th>
                  <th scope="col">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{disp(p.name)}</strong></td>
                    <td>{disp(p.category)}</td>
                    <td>{formatIDR(p.price)}</td>
                    <td>{p.stock}</td>
                    <td><StatusBadge status={p.status} /></td>
                    <td>{p.rejectionReason ? disp(p.rejectionReason) : '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {!readOnly && (
                        <button
                          type="button"
                          className="ks-btn ks-btn-ghost ks-btn-sm"
                          onClick={() => startEdit(p)}
                          aria-label={`Ubah produk ${p.name}`}
                        >
                          ✏️ Ubah
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {editId && (
            <form onSubmit={submitEdit} style={{ marginTop: 12, borderTop: '1px solid var(--ks-border, #e2e8f0)', paddingTop: 12 }} aria-label="Formulir ubah produk">
              <h3 className="ks-panel-title">✏️ Ubah produk</h3>
              <p className="ks-muted-text" style={{ fontSize: 12, margin: '0 0 8px' }}>
                Field sensitif (nama, harga, foto, deskripsi) atas produk approved TIDAK langsung berubah —
                server menjawab 202 dan membuat change request pending (publik tetap data lama).
                {rows.find((r) => r.id === editId)?.status === 'rejected' && (
                  <> Produk ini <StatusBadge status="rejected" /> — menyimpan akan mengajukan ulang (kembali pending).</>
                )}
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <label style={{ flex: '1 1 160px', fontSize: 13 }}>
                  Nama
                  <input className="ks-input" style={{ marginTop: 4 }} value={eName} onChange={(e) => setEName(e.target.value)} maxLength={120} aria-label="Nama produk" />
                </label>
                <label style={{ flex: '1 1 140px', fontSize: 13 }}>
                  Kategori
                  <input className="ks-input" style={{ marginTop: 4 }} value={eCategory} onChange={(e) => setECategory(e.target.value)} maxLength={60} aria-label="Kategori produk" />
                </label>
                <label style={{ flex: '0 1 130px', fontSize: 13 }}>
                  Harga (Rp)
                  <input className="ks-input" style={{ marginTop: 4 }} value={ePrice} onChange={(e) => setEPrice(e.target.value)} inputMode="numeric" aria-label="Harga produk" />
                </label>
                <label style={{ flex: '0 1 110px', fontSize: 13 }}>
                  Stok
                  <input className="ks-input" style={{ marginTop: 4 }} value={eStock} onChange={(e) => setEStock(e.target.value)} inputMode="numeric" aria-label="Stok produk" />
                </label>
                <label style={{ flex: '2 1 240px', fontSize: 13 }}>
                  Deskripsi
                  <textarea className="ks-input" style={{ marginTop: 4 }} value={eDesc} onChange={(e) => setEDesc(e.target.value)} maxLength={5000} rows={2} aria-label="Deskripsi produk" />
                </label>
                <label style={{ flex: '2 1 240px', fontSize: 13 }}>
                  Foto (satu URL per baris, maks 5)
                  <textarea className="ks-input" style={{ marginTop: 4 }} value={ePhotos} onChange={(e) => setEPhotos(e.target.value)} rows={2} aria-label="URL foto produk" placeholder="/uploads/… atau https://…" />
                </label>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="ks-btn ks-btn-primary ks-btn-sm" type="submit" disabled={editBusy}>
                  {editBusy ? 'Menyimpan…' : 'Simpan Perubahan'}
                </button>
                <button className="ks-btn ks-btn-ghost ks-btn-sm" type="button" onClick={() => setEditId(null)}>
                  Batal
                </button>
              </div>
              {editMsg && <p className="ks-muted-text" role="status" style={{ fontSize: 13, marginTop: 8 }}>{editMsg}</p>}
            </form>
          )}
        </section>
      )}

      {/* ---------- Tambah produk ---------- */}
      {!readOnly && (
        <section className="ks-card" style={{ marginTop: 16 }} aria-labelledby="h-add">
          <h2 id="h-add" className="ks-panel-title">➕ Tambah Produk</h2>
          <p className="ks-muted-text" style={{ fontSize: 13, margin: '0 0 12px' }}>
            POST /products — hanya untuk toko berstatus approved; produk baru langsung berstatus pending.
            Foto: path <code>/uploads/…</code> atau URL <code>https</code> (maks 5).
          </p>
          <form onSubmit={submitAdd} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <label style={{ flex: '1 1 160px', fontSize: 13 }}>
              Nama (wajib)
              <input className="ks-input" style={{ marginTop: 4 }} value={fName} onChange={(e) => setFName(e.target.value)} maxLength={120} aria-label="Nama produk baru" />
            </label>
            <label style={{ flex: '1 1 140px', fontSize: 13 }}>
              Kategori (wajib)
              <input className="ks-input" style={{ marginTop: 4 }} value={fCategory} onChange={(e) => setFCategory(e.target.value)} maxLength={60} aria-label="Kategori produk baru" />
            </label>
            <label style={{ flex: '0 1 130px', fontSize: 13 }}>
              Harga Rp (wajib)
              <input className="ks-input" style={{ marginTop: 4 }} value={fPrice} onChange={(e) => setFPrice(e.target.value)} inputMode="numeric" placeholder="Mis. 150000" aria-label="Harga produk baru" />
            </label>
            <label style={{ flex: '0 1 110px', fontSize: 13 }}>
              Stok (wajib)
              <input className="ks-input" style={{ marginTop: 4 }} value={fStock} onChange={(e) => setFStock(e.target.value)} inputMode="numeric" placeholder="Mis. 10" aria-label="Stok produk baru" />
            </label>
            <label style={{ flex: '2 1 240px', fontSize: 13 }}>
              Deskripsi (opsional)
              <textarea className="ks-input" style={{ marginTop: 4 }} value={fDesc} onChange={(e) => setFDesc(e.target.value)} maxLength={5000} rows={2} aria-label="Deskripsi produk baru" />
            </label>
            <label style={{ flex: '2 1 240px', fontSize: 13 }}>
              Foto (opsional, satu URL per baris)
              <textarea className="ks-input" style={{ marginTop: 4 }} value={fPhotos} onChange={(e) => setFPhotos(e.target.value)} rows={2} aria-label="URL foto produk baru" placeholder="/uploads/… atau https://…" />
            </label>
            <button className="ks-btn ks-btn-primary" type="submit" disabled={addBusy} style={{ alignSelf: 'flex-end' }}>
              {addBusy ? 'Menyimpan…' : 'Tambah Produk'}
            </button>
          </form>
          {addMsg && <p className="ks-muted-text" role="status" style={{ fontSize: 13, marginTop: 8 }}>{addMsg}</p>}
        </section>
      )}
    </Shell>
  );
}
