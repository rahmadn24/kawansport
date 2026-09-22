/**
 * Hook Rating & Review (SM-08): fetch/mutate ratings dengan React Query style manual.
 * Menggunakan pattern custom hook yang konsisten dengan codebase (tanpa library eksternal).
 */
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  CreateRatingInput,
  RatingItem,
  RatingSortBy,
  RatingSummary,
  UpdateRatingInput,
  createRating,
  deleteRating,
  getCourtRatingSummary,
  getRatingDetail,
  getVenueRatingSummary,
  listCourtRatings,
  listVenueRatings,
  updateRating,
} from '../api/ratings';

/** Hook untuk summary rating venue (average, count, distribution). */
export function useVenueRatingSummary(venueId: string | null) {
  const [summary, setSummary] = useState<RatingSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!venueId) {
      setSummary(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getVenueRatingSummary(venueId);
      setSummary(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat summary rating');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    fetch().catch(() => undefined);
  }, [fetch]);

  return { summary, loading, error, refetch: fetch };
}

/** Hook untuk summary rating court. */
export function useCourtRatingSummary(courtId: string | null) {
  const [summary, setSummary] = useState<RatingSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!courtId) {
      setSummary(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getCourtRatingSummary(courtId);
      setSummary(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat summary rating');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [courtId]);

  useEffect(() => {
    fetch().catch(() => undefined);
  }, [fetch]);

  return { summary, loading, error, refetch: fetch };
}

/** Hook untuk list rating venue dengan pagination + infinite scroll support. */
export function useVenueRatings(
  venueId: string | null,
  options: { sortBy?: RatingSortBy; pageSize?: number } = {},
) {
  const [ratings, setRatings] = useState<RatingItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { sortBy = 'latest', pageSize = 10 } = options;

  const fetch = useCallback(
    async (p: number, append: boolean) => {
      if (!venueId) {
        if (!append) setRatings([]);
        setTotal(0);
        return;
      }
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);

      try {
        const res = await listVenueRatings(venueId, { page: p, limit: pageSize, sortBy });
        setTotal(res.meta.total);
        setPage(res.meta.page);
        setRatings((prev) => (append ? [...prev, ...res.data] : res.data));
      } catch (e) {
        if (!append) setError(e instanceof Error ? e.message : 'Gagal memuat review');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [venueId, sortBy, pageSize],
  );

  useEffect(() => {
    fetch(1, false).catch(() => undefined);
  }, [fetch]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore) return;
    if (ratings.length >= total) return;
    fetch(page + 1, true).catch(() => undefined);
  }, [loading, loadingMore, ratings.length, total, page, fetch]);

  const refresh = useCallback(() => {
    fetch(1, false).catch(() => undefined);
  }, [fetch]);

  return {
    ratings,
    loading,
    loadingMore,
    error,
    total,
    hasMore: ratings.length < total,
    loadMore,
    refresh,
  };
}

/** Hook untuk list rating court. */
export function useCourtRatings(
  courtId: string | null,
  options: { sortBy?: RatingSortBy; pageSize?: number } = {},
) {
  const [ratings, setRatings] = useState<RatingItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { sortBy = 'latest', pageSize = 10 } = options;

  const fetch = useCallback(
    async (p: number, append: boolean) => {
      if (!courtId) {
        if (!append) setRatings([]);
        setTotal(0);
        return;
      }
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);

      try {
        const res = await listCourtRatings(courtId, { page: p, limit: pageSize, sortBy });
        setTotal(res.meta.total);
        setPage(res.meta.page);
        setRatings((prev) => (append ? [...prev, ...res.data] : res.data));
      } catch (e) {
        if (!append) setError(e instanceof Error ? e.message : 'Gagal memuat review');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [courtId, sortBy, pageSize],
  );

  useEffect(() => {
    fetch(1, false).catch(() => undefined);
  }, [fetch]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore) return;
    if (ratings.length >= total) return;
    fetch(page + 1, true).catch(() => undefined);
  }, [loading, loadingMore, ratings.length, total, page, fetch]);

  const refresh = useCallback(() => {
    fetch(1, false).catch(() => undefined);
  }, [fetch]);

  return {
    ratings,
    loading,
    loadingMore,
    error,
    total,
    hasMore: ratings.length < total,
    loadMore,
    refresh,
  };
}

/** Hook untuk create/update/delete rating (mutations). */
export function useRatingMutations() {
  const { user } = useAuth();
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(
    async (input: CreateRatingInput): Promise<RatingItem | null> => {
      if (!user) {
        setError('Harus login untuk memberi rating');
        return null;
      }
      setMutating(true);
      setError(null);
      try {
        const rating = await createRating(input);
        return rating;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Gagal membuat rating';
        setError(msg);
        return null;
      } finally {
        setMutating(false);
      }
    },
    [user],
  );

  const update = useCallback(
    async (id: string, input: UpdateRatingInput): Promise<RatingItem | null> => {
      if (!user) {
        setError('Harus login untuk mengubah rating');
        return null;
      }
      setMutating(true);
      setError(null);
      try {
        const rating = await updateRating(id, input);
        return rating;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Gagal mengubah rating';
        setError(msg);
        return null;
      } finally {
        setMutating(false);
      }
    },
    [user],
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      if (!user) {
        setError('Harus login untuk menghapus rating');
        return false;
      }
      setMutating(true);
      setError(null);
      try {
        await deleteRating(id);
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Gagal menghapus rating';
        setError(msg);
        return false;
      } finally {
        setMutating(false);
      }
    },
    [user],
  );

  const clearError = useCallback(() => setError(null), []);

  return { create, update, remove, mutating, error, clearError };
}

/** Hook untuk check apakah user sudah rating venue/court. */
export function useUserRatingCheck(
  venueId: string | null,
  courtId: string | null,
): { hasRated: boolean; checking: boolean; rating: RatingItem | null } {
  const { user } = useAuth();
  const [hasRated, setHasRated] = useState(false);
  const [checking, setChecking] = useState(false);
  const [rating, setRating] = useState<RatingItem | null>(null);

  useEffect(() => {
    if (!user || !venueId) {
      setHasRated(false);
      setRating(null);
      return;
    }

    const check = async () => {
      setChecking(true);
      try {
        // Fetch first page, check if user has rated
        const res = await listVenueRatings(venueId, { limit: 50, sortBy: 'latest' });
        const found = res.data.find((r) => r.userId === user.id && r.courtId === (courtId ?? null));
        setHasRated(!!found);
        setRating(found ?? null);
      } catch {
        setHasRated(false);
        setRating(null);
      } finally {
        setChecking(false);
      }
    };

    check().catch(() => undefined);
  }, [user, venueId, courtId]);

  return { hasRated, checking, rating };
}