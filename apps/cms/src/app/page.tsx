'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { dashboardPathFor, fetchMeApi, loginApi } from '@/lib/api';
import { saveSession } from '@/lib/auth';

/** Login CMS via API JWT (POST /auth/login), lalu arahkan sesuai role (GET /me). */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@kawansport.id');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await loginApi(email.trim(), password);
      saveSession(res.accessToken, res.refreshToken);
      const me = await fetchMeApi(res.accessToken);
      router.replace(dashboardPathFor(me.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="ks-login-wrap">
      <div className="ks-login-card">
        <div className="ks-logo">KS</div>
        <h1>KawanSport CMS</h1>
        <p className="sub">
          Masuk untuk mengelola persetujuan, data, dan statistik KawanSport.
        </p>
        <form onSubmit={onSubmit}>
          <div className="ks-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              className="ks-input"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="ks-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              className="ks-input"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <p className="ks-error" role="alert">
              ⚠️ {error}
            </p>
          )}
          <button type="submit" disabled={busy} className="ks-btn ks-btn-primary ks-btn-block">
            {busy ? 'Masuk…' : 'Masuk'}
          </button>
        </form>
        <p className="ks-hint">Akun admin seed: admin@kawansport.id</p>
      </div>
    </main>
  );
}
