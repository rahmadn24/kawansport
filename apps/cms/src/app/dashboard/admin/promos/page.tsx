'use client';

import { useCallback, useEffect, useState } from 'react';
import { RoleGuard } from '@/components/RoleGuard';
import { ADMIN_NAV, Shell } from '@/components/Shell';
import { EmptyState } from '@/components/ui';
import { apiFetch, disp } from '@/lib/api';
import { getAccessToken, useAuth } from '@/lib/auth';

interface PromoItem {
  id: string;
  title: string;
  imageUrl: string;
  link: string | null;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PromosRes {
  data: PromoItem[];
  meta: { total: number };
}

/** Mirror aturan ST-01 API agar admin langsung tahu URL ditolak server. */
function isAllowedImageUrl(url: string): boolean {
  const s = url.trim();
  if (!s || s.length > 2048) return false;
  if (s.startsWith('/uploads/')) {
    if (s.includes('..') || s.includes('\\') || /\s/.test(s)) return false;
    return s.length > '/uploads/'.length;
  }
  try {
    return new URL(s).protocol === 'https:';
  } catch {
    return false;
  }
}

/** Halaman kelola banner promo CMS (ST-09, khusus super_admin). */
export default function AdminPromosPage() {
  return (
    <RoleGuard allowed={['super_admin']}>
      <PromosContent />
    </RoleGuard>
  );
}

function toDateTimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function PromosContent() {
  const { me, logout } = useAuth();
  const [rows, setRows] = useState<PromoItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form tambah.
  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [link, setLink] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<PromosRes>('/promos?all=true', token);
      setRows(res.data ?? []);
      setTotal(res.meta?.total ?? (res.data ?? []).length);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal memuat promo');
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const submit = async () => {
    setFormError(null);
    const t = title.trim();
    if (!t) {
      setFormError('Judul wajib diisi.');
      return;
    }
    if (!isAllowedImageUrl(imageUrl)) {
      setFormError('imageUrl harus path /uploads/... atau URL https (aturan ST-01).');
      return;
    }
    if (startsAt && endsAt && new Date(startsAt).getTime() > new Date(endsAt).getTime()) {
      setFormError('startsAt tidak boleh sesudah endsAt.');
      return;
    }
    const token = getAccessToken();
    if (!token) {
      setFormError('Tidak ada token akses.');
      return;
    }
    setSaving(true);
    try {
      await apiFetch<PromoItem>('/promos', token, {
        method: 'POST',
        body: {
          title: t,
          imageUrl: imageUrl.trim(),
          ...(link.trim() ? { link: link.trim() } : {}),
          ...(startsAt ? { startsAt: new Date(startsAt).toISOString() } : {}),
          ...(endsAt ? { endsAt: new Date(endsAt).toISOString() } : {}),
        },
      });
      setTitle('');
      setImageUrl('');
      setLink('');
      setStartsAt('');
      setEndsAt('');
      await refresh();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Gagal menambah promo');
    } finally {
      setSaving(false);
    }
  };

  const setActive = async (id: string, active: boolean) => {
    const token = getAccessToken();
    if (!token) return;
    setBusyId(id);
    setRowError(null);
    try {
      await apiFetch<PromoItem>(`/promos/${id}`, token, {
        method: 'PATCH',
        body: { active },
      });
      await refresh();
    } catch (e: unknown) {
      setRowError(e instanceof Error ? e.message : 'Gagal mengubah status');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    const token = getAccessToken();
    if (!token) return;
    if (!window.confirm('Hapus banner ini permanen?')) return;
    setBusyId(id);
    setRowError(null);
    try {
      await apiFetch<unknown>(`/promos/${id}`, token, { method: 'DELETE' });
      await refresh();
    } catch (e: unknown) {
      setRowError(e instanceof Error ? e.message : 'Gagal menghapus');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Shell
      me={me}
      onLogout={logout}
      nav={ADMIN_NAV}
      title="Banner Promo"
      subtitle="Kelola banner feed mobile (ST-09). Publik hanya melihat banner aktif dalam periode — kosong = disembunyikan, bukan placeholder."
    >
      <section className="ks-card ks-section" aria-labelledby="h-add">
        <h2 id="h-add" className="ks-panel-title">Tambah banner</h2>
        <div className="ks-form">
          <label>
            Judul (1..120){' '}
            <input
              className="ks-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Promo Mabar Akbar"
              maxLength={120}
            />
          </label>
          <label>
            Gambar (path /uploads/... atau https){' '}
            <input
              className="ks-input"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://cdn.example.com/banner.jpg"
            />
          </label>
          <label>
            Tautan (opsional){' '}
            <input
              className="ks-input"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="kawansport://events"
            />
          </label>
          <div className="ks-grid ks-grid-2">
            <label>
              Tayang dari (opsional){' '}
              <input
                type="datetime-local"
                className="ks-input"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </label>
            <label>
              Tayang sampai (opsional){' '}
              <input
                type="datetime-local"
                className="ks-input"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </label>
          </div>
          {formError && <p className="ks-error" role="alert">⚠️ {formError}</p>}
          <button
            type="button"
            className="ks-btn ks-btn-primary ks-btn-sm"
            onClick={() => void submit()}
            disabled={saving}
          >
            {saving ? 'Menyimpan…' : '＋ Tambah banner (aktif)'}
          </button>
        </div>
      </section>

      <section className="ks-card ks-section" aria-labelledby="h-list">
        <div className="ks-sec-head">
          <div>
            <h2 id="h-list" className="ks-panel-title">Semua banner ({total})</h2>
            <p className="ks-muted-text ks-sub">
              Termasuk nonaktif/kedaluwarsa (GET /promos?all=true). Nonaktifkan = hilang dari feed publik.
            </p>
          </div>
          <button
            type="button"
            className="ks-btn ks-btn-ghost ks-btn-sm"
            onClick={() => void refresh()}
            disabled={loading}
          >
            {loading ? 'Memuat…' : '🔄 Muat ulang'}
          </button>
        </div>
        {error && <p className="ks-error" role="alert">⚠️ Error: {error}</p>}
        {rowError && <p className="ks-error" role="alert">⚠️ {rowError}</p>}
        {rows.length === 0 && !loading ? (
          <EmptyState
            icon="🎟"
            title="Belum ada banner"
            desc="Tambahkan banner pertama lewat form di atas. Feed mobile menyembunyikan section promo bila kosong."
          />
        ) : (
          <div className="ks-table-wrap">
            <table className="ks-table">
              <thead>
                <tr>
                  <th scope="col">Judul & gambar</th>
                  <th scope="col">Status</th>
                  <th scope="col">Periode</th>
                  <th scope="col">Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{disp(r.title)}</strong>
                      <div className="ks-history">{disp(r.imageUrl)}</div>
                      {r.link ? <div className="ks-history">↗ {disp(r.link)}</div> : null}
                    </td>
                    <td>{r.active ? '✅ aktif' : '🚫 nonaktif'}</td>
                    <td>
                      {r.startsAt ? toDateTimeLocal(r.startsAt).replace('T', ' ') : '—'}
                      {' → '}
                      {r.endsAt ? toDateTimeLocal(r.endsAt).replace('T', ' ') : '—'}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="ks-btn ks-btn-ghost ks-btn-sm"
                        onClick={() => void setActive(r.id, !r.active)}
                        disabled={busyId === r.id}
                      >
                        {r.active ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>{' '}
                      <button
                        type="button"
                        className="ks-btn ks-btn-ghost ks-btn-sm"
                        onClick={() => void remove(r.id)}
                        disabled={busyId === r.id}
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
      </section>
    </Shell>
  );
}
