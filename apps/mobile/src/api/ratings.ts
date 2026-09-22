/**
 * API Rating & Review (SM-08): create, list venue/court ratings, detail, update, delete.
 *
 * Fungsi menerima http client opsional agar mudah diuji (default: api).
 */
import { api } from './client';

export type RatingSortBy = 'latest' | 'highest' | 'lowest';

export interface RatingUser {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface ReviewItem {
  id: string;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RatingItem {
  id: string;
  userId: string;
  user: RatingUser;
  venueId: string;
  courtId: string | null;
  score: number;
  review: ReviewItem | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedRatings {
  data: RatingItem[];
  meta: { page: number; limit: number; total: number };
}

export interface CreateRatingInput {
  venueId: string;
  courtId?: string | null;
  score: number;
  comment?: string;
}

export interface UpdateRatingInput {
  score?: number;
  comment?: string;
}

export interface RatingSummary {
  averageScore: number;
  totalRatings: number;
  distribution: Record<number, number>; // 1-5 -> count
}

interface Http {
  get<T>(url: string, config?: { params?: unknown }): Promise<{ data: T }>;
  post<T>(url: string, body: unknown): Promise<{ data: T }>;
  put<T>(url: string, body: unknown): Promise<{ data: T }>;
  delete<T>(url: string): Promise<{ data: T }>;
}

/** POST /api/ratings — create rating + optional review (auth required). */
export async function createRating(
  input: CreateRatingInput,
  http: Http = api,
): Promise<RatingItem> {
  const res = await http.post<RatingItem>('/ratings', input);
  return res.data;
}

/** GET /api/ratings/venues/:venueId/ratings — list venue ratings with pagination. */
export async function listVenueRatings(
  venueId: string,
  params: { page?: number; limit?: number; sortBy?: RatingSortBy } = {},
  http: Http = api,
): Promise<PaginatedRatings> {
  const res = await http.get<PaginatedRatings>(`/ratings/venues/${venueId}/ratings`, { params });
  return res.data;
}

/** GET /api/ratings/courts/:courtId/ratings — list court ratings with pagination. */
export async function listCourtRatings(
  courtId: string,
  params: { page?: number; limit?: number; sortBy?: RatingSortBy } = {},
  http: Http = api,
): Promise<PaginatedRatings> {
  const res = await http.get<PaginatedRatings>(`/ratings/courts/${courtId}/ratings`, { params });
  return res.data;
}

/** GET /api/ratings/:id — detail rating + review. */
export async function getRatingDetail(
  id: string,
  http: Http = api,
): Promise<RatingItem> {
  const res = await http.get<RatingItem>(`/ratings/${id}`);
  return res.data;
}

/** PUT /api/ratings/:id — update rating/review (auth, owner only). */
export async function updateRating(
  id: string,
  input: UpdateRatingInput,
  http: Http = api,
): Promise<RatingItem> {
  const res = await http.put<RatingItem>(`/ratings/${id}`, input);
  return res.data;
}

/** DELETE /api/ratings/:id — delete rating (auth, owner/admin). */
export async function deleteRating(
  id: string,
  http: Http = api,
): Promise<void> {
  await http.delete(`/ratings/${id}`);
}

/** GET /api/ratings/venues/:venueId/ratings/summary — rating summary (average, count, distribution). */
export async function getVenueRatingSummary(
  venueId: string,
  http: Http = api,
): Promise<RatingSummary> {
  // This endpoint may not exist yet on backend; fallback to computing from list
  const res = await http.get<PaginatedRatings>(`/ratings/venues/${venueId}/ratings`, {
    params: { limit: 1000, sortBy: 'latest' },
  });
  return computeSummary(res.data.data);
}

/** GET /api/ratings/courts/:courtId/ratings/summary — court rating summary. */
export async function getCourtRatingSummary(
  courtId: string,
  http: Http = api,
): Promise<RatingSummary> {
  const res = await http.get<PaginatedRatings>(`/ratings/courts/${courtId}/ratings`, {
    params: { limit: 1000, sortBy: 'latest' },
  });
  return computeSummary(res.data.data);
}

/** Compute summary from rating list (client-side fallback). */
function computeSummary(ratings: RatingItem[]): RatingSummary {
  const totalRatings = ratings.length;
  if (totalRatings === 0) {
    return {
      averageScore: 0,
      totalRatings: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    };
  }

  const sum = ratings.reduce((acc, r) => acc + r.score, 0);
  const averageScore = Math.round((sum / totalRatings) * 10) / 10; // 1 decimal

  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  ratings.forEach((r) => {
    if (r.score >= 1 && r.score <= 5) {
      distribution[r.score]++;
    }
  });

  return { averageScore, totalRatings, distribution };
}