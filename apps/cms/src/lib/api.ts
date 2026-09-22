/** Tipe role RBAC — mirror enum API (AD-01). */
export type UserRole = 'super_admin' | 'venue_owner' | 'seller' | 'user';

export interface MeResponse {
  id: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  sports: string[];
  skillLevel: string | null;
  lat: number | null;
  lng: number | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LoginResponse {
  user: MeResponse;
  accessToken: string;
  refreshToken: string;
}

export function apiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
}

/** POST /auth/login → token pair + user (termasuk role). */
export async function loginApi(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${apiUrl()}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(res.status === 401 ? 'Email atau password salah' : `Login gagal (${res.status})`);
  }
  return (await res.json()) as LoginResponse;
}

/** GET /me → profil + role (dipakai guard route client). */
export async function fetchMeApi(accessToken: string): Promise<MeResponse> {
  const res = await fetch(`${apiUrl()}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`GET /me gagal (${res.status})`);
  return (await res.json()) as MeResponse;
}

/** Redirect dashboard default per role setelah login. */
export function dashboardPathFor(role: UserRole): string {
  switch (role) {
    case 'super_admin':
      return '/dashboard/admin';
    case 'venue_owner':
      return '/dashboard/owner';
    case 'seller':
      return '/dashboard/seller';
    default:
      return '/dashboard';
  }
}

/** Baris generik untuk tabel admin CMS (kolom diakses via accessor). */
export type AdminRow = Record<string, unknown>;

export interface AdminListResponse<T = AdminRow> {
  data: T[];
  meta: { total: number; page?: number; limit?: number };
}

/**
 * Fetch authed ke API (dipakai halaman admin CMS).
 * Melempar Error `HTTP <status> <body>` bila tidak ok.
 */
export async function apiFetch<T>(
  path: string,
  token: string,
  options?: { method?: string; body?: unknown },
): Promise<T> {
  const res = await fetch(`${apiUrl()}${path}`, {
    method: options?.method ?? 'GET',
    headers: {
      ...(options?.body !== undefined
        ? { 'Content-Type': 'application/json' }
        : {}),
      Authorization: `Bearer ${token}`,
    },
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    let detail = '';
    try {
      detail = JSON.stringify(await res.json());
    } catch {
      // Badan error bukan JSON — abaikan.
    }
    throw new Error(`HTTP ${res.status}${detail ? ` ${detail}` : ''}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Tampilkan nilai sel tabel secara aman (null/objek tidak merusak render). */
export function disp(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
    return String(v);
  }
  try {
    const s = JSON.stringify(v);
    return s.length > 80 ? `${s.slice(0, 77)}…` : s;
  } catch {
    return '—';
  }
}
