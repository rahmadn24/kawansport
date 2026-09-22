import React, { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Button,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CourtItem, SlotItem, VenueItem, activeCourts } from '../api/venues';
import { formatDateShort, formatIDR } from '../api/bookings';
import { useAuth } from '../auth/AuthContext';
import { RatingStarsDisplay } from '../components/RatingStars';
import { RatingFormModal } from '../components/RatingFormModal';
import { RatingReviewScreen } from './venue/RatingReviewScreen';
import { useVenueRatingSummary, useUserRatingCheck, useRatingMutations } from '../hooks/useRatings';
import { CreateRatingInput } from '../api/ratings';

interface Props {
  venue: VenueItem | null;
  loading: boolean;
  error: string | null;
  /** Court yang dipilih (default: pertama yang aktif). */
  court: CourtItem | null;
  onCourtChange: (court: CourtItem) => void;
  /** Tanggal YYYY-MM-DD yang dipilih. */
  date: string;
  onDateChange: (date: string) => void;
  /** Strip tanggal untuk picker (default 14 hari ke depan). */
  dateOptions: string[];
  slots: SlotItem[];
  slotsLoading: boolean;
  slotsError: string | null;
  /** Proses booking slot sedang berjalan (per start, mis. "09:00"). */
  bookingStart: string | null;
  bookError: string | null;
  onBook: (slot: SlotItem) => void;
  onBack: () => void;
}

/**
 * Layar Venue Detail (BK-04): pilih court + tanggal (strip 14 hari) +
 * daftar slot (free/held/booked) + tombol Book per slot free.
 * Plus Rating & Review section (SM-08).
 */
export function VenueDetailScreen({
  venue,
  loading,
  error,
  court,
  onCourtChange,
  date,
  onDateChange,
  dateOptions,
  slots,
  slotsLoading,
  slotsError,
  bookingStart,
  bookError,
  onBook,
  onBack,
}: Props) {
  const { user } = useAuth();
  const courts = venue ? activeCourts(venue) : [];

  // Rating hooks
  const { summary, loading: summaryLoading, error: summaryError } = useVenueRatingSummary(
    venue?.id ?? null,
  );
  const { hasRated, checking: checkRatingLoading } = useUserRatingCheck(
    venue?.id ?? null,
    court?.id ?? null,
  );
  const { create: createRating, mutating: ratingSubmitting, error: ratingError, clearError } =
    useRatingMutations();

  // Modal states
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);

  // Handle rating submit
  const handleRatingSubmit = useCallback(
    async (input: CreateRatingInput) => {
      await createRating(input);
      clearError();
    },
    [createRating, clearError],
  );

  // Render rating section
  const renderRatingSection = () => {
    if (!venue) return null;

    return (
      <View style={styles.ratingSection}>
        <View style={styles.ratingHeader}>
          <Text style={styles.section}>Rating & Ulasan</Text>
          {summary && summary.totalRatings > 0 && (
            <TouchableOpacity
              onPress={() => setShowAllReviews(true)}
              style={styles.seeAllButton}
              activeOpacity={0.7}
            >
              <Text style={styles.seeAllText}>Lihat Semua ({summary.totalRatings})</Text>
            </TouchableOpacity>
          )}
        </View>

        {summaryLoading ? (
          <ActivityIndicator style={styles.ratingLoader} />
        ) : summary && summary.totalRatings > 0 ? (
          <View style={styles.ratingSummary}>
            <View style={styles.ratingMain}>
              <Text style={styles.averageScore}>{summary.averageScore.toFixed(1)}</Text>
              <RatingStarsDisplay
                value={summary.averageScore}
                size={24}
                showValue={false}
              />
              <Text style={styles.totalReviews}>{summary.totalRatings} ulasan</Text>
            </View>
            <View style={styles.miniBars}>
              {[5, 4, 3, 2, 1].map((star) => {
                const count = summary.distribution[star] || 0;
                const percentage =
                  summary.totalRatings > 0 ? (count / summary.totalRatings) * 100 : 0;
                return (
                  <View key={star} style={styles.miniBarRow}>
                    <Text style={styles.miniBarLabel}>{star}</Text>
                    <View style={styles.miniBarTrack}>
                      <View
                        style={[
                          styles.miniBarFill,
                          { width: `${percentage}%` },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <Text style={styles.noReviews}>Belum ada rating untuk venue ini</Text>
        )}

        {/* Write Review Button */}
        {user && !checkRatingLoading && !hasRated && (
          <TouchableOpacity
            onPress={() => setShowRatingModal(true)}
            style={styles.writeReviewButton}
            activeOpacity={0.7}
          >
            <Text style={styles.writeReviewText}>Tulis Ulasan</Text>
          </TouchableOpacity>
        )}

        {user && hasRated && !checkRatingLoading && (
          <Text style={styles.alreadyReviewed}>Anda sudah memberikan rating untuk venue ini</Text>
        )}

        {summaryError && <Text style={styles.error}>{summaryError}</Text>}
      </View>
    );
  };

  // Rating Form Modal
  const ratingModalTarget = court ? 'court' : 'venue';
  const ratingTargetName = court ? court.name : venue?.name ?? '';

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Detail Venue</Text>
      {loading && !venue ? (
        <ActivityIndicator />
      ) : venue ? (
        <ScrollView style={styles.scroll}>
          <Text style={styles.name}>{venue.name}</Text>
          <Text style={styles.sub}>
            {venue.sports.join(', ')} • {venue.address}
          </Text>

          <Text style={styles.section}>Lapangan</Text>
          {courts.length === 0 ? (
            <Text style={styles.sub}>Tidak ada lapangan aktif.</Text>
          ) : (
            <View style={styles.chips}>
              {courts.map((c) => {
                const selected = court?.id === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.chip, selected && styles.chipActive]}
                    onPress={() => onCourtChange(c)}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                      {c.name} • {formatIDR(c.pricePerHour)}/jam
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <Text style={styles.section}>Tanggal ({formatDateShort(date)})</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chips}>
              {dateOptions.map((d) => {
                const selected = d === date;
                return (
                  <TouchableOpacity
                    key={d}
                    style={[styles.chip, selected && styles.chipActive]}
                    onPress={() => onDateChange(d)}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                      {formatDateShort(d)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Rating & Review Section */}
          {renderRatingSection()}

          <Text style={styles.section}>Slot</Text>
          {slotsLoading ? (
            <ActivityIndicator />
          ) : slots.length === 0 ? (
            <Text style={styles.sub}>Tidak ada slot di tanggal ini.</Text>
          ) : (
            slots.map((s) => (
              <View key={s.start} style={styles.slotRow}>
                <View style={styles.slotInfo}>
                  <Text style={styles.slotTime}>
                    {s.start}–{s.end}
                  </Text>
                  <Text
                    style={
                      s.status === 'free'
                        ? styles.slotFree
                        : s.status === 'held'
                        ? styles.slotHeld
                        : styles.slotBooked
                    }
                  >
                    {s.status === 'free' ? 'FREE' : s.status === 'held' ? 'HELD' : 'BOOKED'}
                  </Text>
                </View>
                {s.status === 'free' ? (
                  bookingStart === s.start ? (
                    <ActivityIndicator />
                  ) : (
                    <Button title="Book" onPress={() => onBook(s)} />
                  )
                ) : null}
              </View>
            ))
          )}
          {slotsError ? <Text style={styles.error}>{slotsError}</Text> : null}
          {bookError ? <Text style={styles.error}>{bookError}</Text> : null}
        </ScrollView>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.gap} />
      <Button title="Kembali" onPress={onBack} />

      {/* Rating Form Modal */}
      <RatingFormModal
        visible={showRatingModal}
        onClose={() => setShowRatingModal(false)}
        onSubmit={handleRatingSubmit}
        venueId={venue?.id ?? ''}
        courtId={court?.id ?? null}
        targetName={ratingTargetName}
        targetType={ratingModalTarget}
        submitting={ratingSubmitting}
        error={ratingError}
      />

      {/* All Reviews Modal/Screen */}
      {showAllReviews && venue && (
        <RatingReviewScreen
          venueId={venue.id}
          venueName={venue.name}
          onClose={() => setShowAllReviews(false)}
          currentUserId={user?.id ?? null}
          courtId={court?.id ?? null}
          courtName={court?.name}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, padding: 24 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  scroll: { flex: 1 },
  name: { fontSize: 18, fontWeight: '700' },
  sub: { fontSize: 14, color: '#444', marginTop: 6 },
  section: { fontSize: 15, fontWeight: '700', marginTop: 16, marginBottom: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: {
    borderWidth: 1,
    borderColor: '#888',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: { backgroundColor: '#1a73e8', borderColor: '#1a73e8' },
  chipText: { color: '#333' },
  chipTextActive: { color: '#fff' },
  slotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  slotInfo: { flexDirection: 'row', alignItems: 'center' },
  slotTime: { fontSize: 15, fontWeight: '700', marginRight: 12 },
  slotFree: { color: '#0a7d2c', fontWeight: '700' },
  slotHeld: { color: '#b7791f', fontWeight: '700' },
  slotBooked: { color: '#c00', fontWeight: '700' },
  gap: { height: 12 },
  error: { color: '#c00', marginTop: 8, textAlign: 'center' },

  /* Rating & Review styles */
  ratingSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  ratingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  seeAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  seeAllText: {
    fontSize: 13,
    color: '#1A73E8',
    fontWeight: '600',
  },
  ratingLoader: {
    marginVertical: 16,
  },
  ratingSummary: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
  },
  ratingMain: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  averageScore: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1A1A1A',
    marginRight: 8,
  },
  totalReviews: {
    fontSize: 14,
    color: '#888',
    marginLeft: 8,
  },
  miniBars: {
    gap: 4,
  },
  miniBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 14,
  },
  miniBarLabel: {
    width: 20,
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
  },
  miniBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  miniBarFill: {
    height: '100%',
    backgroundColor: '#FFC107',
    borderRadius: 3,
  },
  noReviews: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    paddingVertical: 16,
  },
  writeReviewButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#1A73E8',
    borderRadius: 8,
    alignSelf: 'center',
  },
  writeReviewText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  alreadyReviewed: {
    marginTop: 16,
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
  },
});