'use client';

import type { ReactNode } from 'react';
import { roleAllowed, useAuth } from '@/lib/auth';
import type { UserRole } from '@/lib/api';

interface Props {
  /** Role yang boleh membuka halaman (super_admin selalu lolos). */
  allowed: UserRole[];
  children: ReactNode;
}

/** Guard route client: cek token → GET /me → cek role → konten / 403. */
export function RoleGuard({ allowed, children }: Props) {
  const { me, loading, error, logout } = useAuth();

  if (loading) return <main className="ks-login-wrap"><div className="ks-login-card"><p className="ks-muted-text">Memuat sesi…</p></div></main>;
  if (error || !me) {
    return (
      <main className="ks-login-wrap">
        <div className="ks-login-card">
          <div className="ks-logo">KS</div>
          <h1>Sesi bermasalah</h1>
          <p className="sub">{error ?? 'Profil tidak ditemukan.'}</p>
          <button className="ks-btn ks-btn-primary ks-btn-block" onClick={logout}>Kembali ke login</button>
        </div>
      </main>
    );
  }
  if (!roleAllowed(me.role, allowed)) {
    return (
      <main className="ks-login-wrap">
        <div className="ks-login-card">
          <div className="ks-logo">KS</div>
          <h1>403 — Akses ditolak</h1>
          <p className="sub">
            Role <code>{me.role}</code> tidak boleh membuka halaman ini.
          </p>
          <button className="ks-btn ks-btn-primary ks-btn-block" onClick={logout}>Ganti akun</button>
        </div>
      </main>
    );
  }
  return <>{children}</>;
}
