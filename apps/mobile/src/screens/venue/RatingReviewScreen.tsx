import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { RatingItem, RatingSortBy } from '../../api/ratings';
import { useVenueRatings, useVenueRatingSummary, useCourtRatings, useCourtRatingSummary } from '../../hooks/useRatings';
import { ReviewCard } from '../../components/ReviewCard';
import { RatingStarsDisplay } from '../../components/RatingStars';

interface Props {
  venueId: string;
  venueName: string;
  onClose: () => void;
  currentUserId?: string | null;
  courtId?: string | null;
  courtName?: string;
}

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
    total,
    hasMore,
    loadMore,
    refresh,
  } = isCourt
    ? useCourtRatings(targetId, { pageSize: 10 })
    : useVenueRatings(targetId, { pageSize: 10 });

  // Sort state
  const [sortBy, setSortBy] = useState<RatingSortBy>('latest');

  // Re-fetch when sort changes
  useEffect(() => {
    refresh();
  }, [sortBy, refresh]);

  const handleRefresh = useCallback(() => {
    refresh();
    refetchSummary?.();
  }, [refresh, refetchSummary]);

  const handleLoadMore = useCallback(() => {
    loadMore();
  }, [loadMore]);

type ListItem = { key: 'distribution' } | { key: string; item: RatingItem };

  const renderRatingDistribution = () => {
    if (!summary || summary.totalRatings === 0) return null;

    const { averageScore, totalRatings, distribution } = summary;
    const maxCount = Math.max(...Object.values(distribution) as number[]);

    return (
      <View style={styles.distributionContainer}>
        <View style={styles.summaryMain}>
          <Text style={styles.averageScore}>{averageScore.toFixed(1)}</Text>
          <RatingStarsDisplay value={averageScore} size={28} showValue={false} />
          <Text style={styles.totalText}>{totalRatings} ulasan</Text>
        </View>

        <View style={styles.barsContainer}>
          {[5, 4, 3, 2, 1].map((star) => {
            const count = distribution[star] || 0;
            const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
            return (
              <View key={star} style={styles.barRow}>
                <Text style={styles.barLabel}>{star}★</Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${percentage}%` },
                    ]}
                  />
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
      onUserPress={(userId) => {
        // TODO: Navigate to user profile
        console.log('User profile:', userId);
      }}
    />
  );

  const renderFooter = () => {
    if (loadingMore) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator />
          <Text style={styles.footerText}>Memuat lebih banyak...</Text>
        </View>
      );
    }
    if (!loading && ratings.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            Belum ada ulasan untuk {targetName}
          </Text>
          <Text style={styles.emptySub}>Jadilah yang pertama memberikan rating!</Text>
        </View>
      );
    }
    return null;
  };

  const sortOptions: { value: RatingSortBy; label: string }[] = [
    { value: 'latest', label: 'Terbaru' },
    { value: 'highest', label: 'Rating Tertinggi' },
    { value: 'lowest', label: 'Rating Terendah' },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backButton} activeOpacity={0.7}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ulasan & Rating</Text>
        <View style={{ width: 32 }} />
      </View>

      <FlatList<ListItem>
        data={[{ key: 'distribution' }, ...ratings.map((r) => ({ key: r.id, item: r }))]}
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
        onEndReached={handleLoadMore}
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
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 8,
  },
  backText: {
    fontSize: 24,
    color: '#333',
    lineHeight: 24,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    color: '#1A1A1A',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  distributionContainer: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 16,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryMain: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  averageScore: {
    fontSize: 48,
    fontWeight: '700',
    color: '#1A1A1A',
    marginRight: 12,
  },
  totalText: {
    fontSize: 14,
    color: '#888',
    marginLeft: 8,
  },
  barsContainer: {
    gap: 6,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 20,
  },
  barLabel: {
    width: 30,
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#F0F0F0',
    borderRadius: 4,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#FFC107',
    borderRadius: 4,
  },
  barCount: {
    width: 30,
    fontSize: 12,
    color: '#888',
    textAlign: 'right',
  },
  footerLoader: {
    padding: 16,
    alignItems: 'center',
  },
  footerText: {
    marginTop: 8,
    fontSize: 13,
    color: '#888',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  emptySub: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
});