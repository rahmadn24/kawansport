import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { RatingItem, RatingSortBy } from '../../api/ratings';
import { useVenueRatings, useVenueRatingSummary, useCourtRatings, useCourtRatingSummary } from '../../hooks/useRatings';
import { ReviewCard } from '../../components/ReviewCard';
import { RatingStarsDisplay } from '../../components/RatingStars';
import { COLORS, RADIUS, SPACING, TYPO, friendlyServerError } from '../../theme';
import { UIAppBar, UIEmptyState, UIErrorBanner, UISegmented, UISkeleton } from '../../components/ui';

interface Props {
  venueId: string;
  venueName: string;
  onClose: () => void;
  currentUserId?: string | null;
  courtId?: string | null;
  courtName?: string;
}

// TODO(ST-06): ringkasan aspek/tag/foto DISEMBUNYIKAN sampai API review kaya ada.

export function RatingReviewScreen({
  venueId,
  venueName,
  onClose,
  currentUserId,
  courtId,
  courtName,
}: Props) {
  const isCourt = !!courtId;
  const targetId = courtId ?? venueId;
  const targetName = courtName ?? venueName;

  // Sort state — diteruskan ke hooks agar segmented BERFUNGSI (server-side).
  const [sortBy, setSortBy] = useState<RatingSortBy>('latest');

  // Summary hook
  const { summary, loading: summaryLoading, error: summaryError, refetch: refetchSummary } =
    isCourt
      ? useCourtRatingSummary(targetId)
      : useVenueRatingSummary(targetId);

  // List hook with infinite scroll
  const {
    ratings,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    refresh,
  } = isCourt
    ? useCourtRatings(targetId, { pageSize: 10, sortBy })
    : useVenueRatings(targetId, { pageSize: 10, sortBy });

  const handleRefresh = useCallback(() => {
    refresh();
    refetchSummary?.();
  }, [refresh, refetchSummary]);

  const handleLoadMore = useCallback(() => {
    loadMore();
  }, [loadMore]);

  type ListItem = { key: 'summary' } | { key: string; item: RatingItem };

  const renderRatingDistribution = () => {
    if (summaryLoading) {
      return (
        <View style={styles.summaryCard}>
          <UISkeleton rows={2} />
        </View>
      );
    }
    if (summaryError || !summary || summary.totalRatings === 0) return null;

    const { averageScore, totalRatings, distribution } = summary;

    return (
      <View style={styles.summaryCard}>
        <View style={styles.summaryMain}>
          <Text style={styles.averageScore}>{averageScore.toFixed(1)}</Text>
          <View style={styles.summarySide}>
            <RatingStarsDisplay value={averageScore} size={20} showValue={false} />
            <Text style={styles.totalText}>{totalRatings} ulasan</Text>
          </View>
        </View>

        <View style={styles.barsContainer}>
          {[5, 4, 3, 2, 1].map((star) => {
            const count = distribution[star] || 0;
            // Proporsional terhadap TOTAL ulasan (bukan terhadap bar tertinggi).
            const percentage = totalRatings > 0 ? (count / totalRatings) * 100 : 0;
            return (
              <View
                key={star}
                style={styles.barRow}
                accessibilityLabel={`${count} ulasan bintang ${star}`}
              >
                <Text style={styles.barLabel}>{star}★</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${percentage}%` }]} />
                </View>
                <Text style={styles.barCount}>{count}</Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderItem = ({ item }: { item: RatingItem }) => (
    <ReviewCard
      rating={item}
      currentUserId={currentUserId}
      onUserPress={() => undefined}
    />
  );

  const renderFooter = () => {
    if (loadingMore) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator accessibilityLabel="Memuat ulasan berikutnya" />
          <Text style={styles.footerText}>Memuat ulasan lain…</Text>
        </View>
      );
    }
    if (!loading && ratings.length === 0) {
      return (
        <UIEmptyState
          illustration="⭐"
          title={`Belum ada ulasan untuk ${targetName}`}
          message="Main di sini? Jadilah yang pertama cerita pengalamanmu!"
        />
      );
    }
    return null;
  };

  return (
    <View style={styles.container}>
      <View style={styles.padded}>
        <UIAppBar title="Ulasan & Rating" onBack={onClose} backLabel="Tutup" />
        <Text style={styles.targetName} numberOfLines={1}>
          {targetName}
        </Text>
        <UISegmented<RatingSortBy>
          label="Urutkan ulasan"
          value={sortBy}
          onChange={(v) => setSortBy(v ?? 'latest')}
          options={[
            { value: 'latest', label: 'Terbaru' },
            { value: 'highest', label: 'Tertinggi' },
            { value: 'lowest', label: 'Terendah' },
          ]}
        />
        <UIErrorBanner message={friendlyServerError(error)} actionLabel="Coba lagi" onAction={handleRefresh} />
      </View>

      <FlatList<ListItem>
        data={[{ key: 'summary' }, ...ratings.map((r) => ({ key: r.id, item: r }))]}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={handleRefresh} />
        }
        ListHeaderComponent={renderRatingDistribution}
        ListFooterComponent={renderFooter}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => {
          if ('item' in item) {
            return renderItem({ item: item.item });
          }
          return null;
        }}
        onEndReached={hasMore ? handleLoadMore : null}
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  padded: { paddingHorizontal: SPACING.screen, paddingTop: SPACING.screen },
  targetName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.brand700,
    marginBottom: SPACING.sm,
  },
  listContent: {
    paddingHorizontal: SPACING.screen,
    paddingBottom: 32,
  },
  summaryCard: {
    backgroundColor: COLORS.bgAlt,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  summaryMain: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  averageScore: {
    ...TYPO.display,
    color: COLORS.ink,
    marginRight: SPACING.md,
  },
  summarySide: { flex: 1 },
  totalText: {
    fontSize: 14,
    color: COLORS.muted,
    marginTop: 4,
  },
  barsContainer: {
    gap: 6,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 24,
  },
  barLabel: {
    width: 32,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.muted,
  },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.line,
    borderRadius: 4,
    marginHorizontal: SPACING.sm,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: COLORS.star,
    borderRadius: 4,
  },
  barCount: {
    width: 32,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.muted,
    textAlign: 'right',
  },
  footerLoader: {
    padding: SPACING.lg,
    alignItems: 'center',
  },
  footerText: {
    marginTop: SPACING.sm,
    fontSize: 13,
    color: COLORS.faint,
  },
});
