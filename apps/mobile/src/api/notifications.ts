/**
 * API riwayat notifikasi (GAP-01): GET /notifications/me + POST /notifications/:id/read.
 *
 * Sumber kebenaran shape: apps/api/ENDPOINTS.md seksi GAP-01.
 * Fungsi menerima http client opsional agar mudah diuji (default: api).
 */
import { api } from './client';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsResult {
  data: AppNotification[];
  meta: { page: number; limit: number; total: number };
}

interface Http {
  get<T>(url: string, config?: { params?: unknown }): Promise<{ data: T }>;
  post<T>(url: string, body: unknown): Promise<{ data: T }>;
}

/** GET /notifications/me?page&limit — terbaru dulu (createdAt DESC). */
export async function listMyNotifications(
  page = 1,
  limit = 20,
  http: Http = api,
): Promise<NotificationsResult> {
  const res = await http.get<NotificationsResult>('/notifications/me', {
    params: { page, limit },
  });
  return res.data;
}

/** POST /notifications/:id/read — tandai dibaca milik sendiri (idempotent). */
export async function markNotificationRead(
  id: string,
  http: Http = api,
): Promise<AppNotification> {
  const res = await http.post<AppNotification>(`/notifications/${id}/read`, {});
  return res.data;
}

/** Jumlah belum dibaca (readAt null) — display-only untuk badge/empty state. */
export function countUnreadNotifications(items: AppNotification[]): number {
  return items.filter((n) => !n.readAt).length;
}
