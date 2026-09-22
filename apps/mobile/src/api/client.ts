/**
 * Axios client SM-02 dengan auto-refresh (SM-02).
 *
 * - Request interceptor: sisipkan `Authorization: Bearer <accessToken>`.
 * - Response interceptor: saat 401 (bukan dari /auth/*), coba POST /auth/refresh
 *   sekali memakai refresh token tersimpan, lalu ulangi request awal.
 * - Antrean: request 401 bersamaan menunggu satu proses refresh (single-flight).
 */
import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
} from 'axios';
import {
  clearTokens,
  getTokens,
  setAccessToken,
  setTokens,
} from './tokenStorage';
import { API_URL } from '../config';

export { API_URL };

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

let refreshing: Promise<string> | null = null;

export async function refreshAccessToken(
  http: Pick<AxiosInstance, 'post'> = axios,
  baseURL: string = API_URL,
): Promise<string> {
  if (!refreshing) {
    refreshing = (async () => {
      const { refreshToken } = await getTokens();
      if (!refreshToken) throw new Error('No refresh token');
      const res = await http.post<TokenPair>(
        `${baseURL}/auth/refresh`,
        { refreshToken },
        { headers: { Authorization: undefined } },
      );
      await setTokens({
        accessToken: res.data.accessToken,
        refreshToken: res.data.refreshToken,
      });
      return res.data.accessToken;
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

function isAuthEndpoint(url?: string): boolean {
  return !!url && /\/auth\/(login|register|refresh|logout)/.test(url);
}

export function createApiClient(baseURL: string = API_URL): AxiosInstance {
  const client = axios.create({ baseURL });

  client.interceptors.request.use(async (config) => {
    const { accessToken } = await getTokens();
    if (accessToken) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  });

  client.interceptors.response.use(
    (res: AxiosResponse) => res,
    async (error: AxiosError) => {
      const original = error.config as (AxiosRequestConfig & { _retried?: boolean }) | undefined;
      const status = error.response?.status;
      if (
        status === 401 &&
        original &&
        !original._retried &&
        !isAuthEndpoint(original.url)
      ) {
        original._retried = true;
        try {
          const accessToken = await refreshAccessToken(axios, baseURL);
          // Sinkronkan token baru ke storage terpusat agar request lain konsisten.
          await setAccessToken(accessToken);
          original.headers = original.headers ?? {};
          (original.headers as Record<string, string>).Authorization =
            `Bearer ${accessToken}`;
          return client(original);
        } catch (refreshError) {
          await clearTokens();
          return Promise.reject(refreshError);
        }
      }
      return Promise.reject(error);
    },
  );

  return client;
}

export const api = createApiClient();
