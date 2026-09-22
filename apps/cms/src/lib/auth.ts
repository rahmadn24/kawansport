'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { fetchMeApi, type MeResponse, type UserRole } from '@/lib/api';

const ACCESS_KEY = 'cms.accessToken';
const REFRESH_KEY = 'cms.refreshToken';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ACCESS_KEY);
}

export function saveSession(accessToken: string, refreshToken: string): void {
  window.localStorage.setItem(ACCESS_KEY, accessToken);
  window.localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearSession(): void {
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
}

interface AuthState {
  me: MeResponse | null;
  loading: boolean;
  error: string | null;
  logout: () => void;
}

/** Ambil /me dari token tersimpan; null + redirect ke / bila tanpa token. */
export function useAuth(): AuthState {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const logout = useCallback(() => {
    clearSession();
    router.replace('/');
  }, [router]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace('/');
      return;
    }
    fetchMeApi(token)
      .then(setMe)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Gagal memuat profil'))
      .finally(() => setLoading(false));
  }, [router]);

  return { me, loading, error, logout };
}

/** Guard client: lolos bila role user termasuk allowed (super_admin selalu lolos). */
export function roleAllowed(role: UserRole | undefined, allowed: UserRole[]): boolean {
  if (!role) return false;
  if (role === 'super_admin') return true;
  return allowed.includes(role);
}
