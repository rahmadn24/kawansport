import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api } from '../api/client';
import {
  SkillLevel,
  UpdateProfileInput,
  updateMe as apiUpdateMe,
} from '../api/profile';
import { clearTokens, getTokens, setTokens } from '../api/tokenStorage';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  sports: string[];
  skillLevel: SkillLevel | null;
  lat: number | null;
  lng: number | null;
  avatarUrl: string | null;
  createdAt?: string;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  initializing: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (input: UpdateProfileInput) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function toErrorMessage(e: unknown): string {
  if (typeof e === 'object' && e !== null) {
    const data = (e as { response?: { data?: { message?: unknown } } }).response?.data;
    if (data && typeof data.message === 'string') return data.message;
    if (Array.isArray(data?.message)) return data.message.join(', ');
    const msg = (e as { message?: unknown }).message;
    if (typeof msg === 'string') return msg;
  }
  return 'Request failed';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshProfile = useCallback(async () => {
    const { accessToken } = await getTokens();
    if (!accessToken) {
      setUser(null);
      return;
    }
    const res = await api.get<AuthUser>('/me');
    setUser(res.data);
  }, []);

  useEffect(() => {
    refreshProfile()
      .catch(() => setUser(null))
      .finally(() => setInitializing(false));
  }, [refreshProfile]);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/auth/login', { email, password });
      await setTokens({
        accessToken: res.data.accessToken,
        refreshToken: res.data.refreshToken,
      });
      setUser(res.data.user);
    } catch (e) {
      setError(toErrorMessage(e));
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(
    async (email: string, password: string, displayName?: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.post('/auth/register', { email, password, displayName });
        await setTokens({
          accessToken: res.data.accessToken,
          refreshToken: res.data.refreshToken,
        });
        setUser(res.data.user);
      } catch (e) {
        setError(toErrorMessage(e));
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      const { refreshToken } = await getTokens();
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken });
      }
    } catch {
      // Logout best-effort: token lokal tetap dibersihkan.
    } finally {
      await clearTokens();
      setUser(null);
      setLoading(false);
    }
  }, []);

  const updateProfile = useCallback(async (input: UpdateProfileInput) => {
    setLoading(true);
    setError(null);
    try {
      const updated = await apiUpdateMe(input);
      setUser(updated);
    } catch (e) {
      setError(toErrorMessage(e));
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, initializing, error, login, register, logout, refreshProfile, updateProfile }),
    [user, loading, initializing, error, login, register, logout, refreshProfile, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
