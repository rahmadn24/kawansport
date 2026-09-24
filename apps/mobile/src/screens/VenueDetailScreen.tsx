import React, { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CourtItem, SlotItem, VenueItem, activeCourts, isBookable } from '../api/venues';
import { formatDateShort, formatIDR } from '../api/bookings';
import { useAuth } from '../auth/AuthContext';
import { RatingStarsDisplay } from '../components/RatingStars';
import { RatingFormModal } from '../components/RatingFormModal';
import { RatingReviewScreen } from './venue/RatingReviewScreen';
import { useVenueRatingSummary, useUserRatingCheck, useRatingMutations } from '../hooks/useRatings';
import { CreateRatingInput } from '../api/ratings';
import { COLORS, HERO, RADIUS, SPACING, TYPO, formatKm, initialsOf } from '../theme';
import {
  UIBadge,
  UIErrorBanner,
  UISectionTitle,
  UISkeleton,
  UIStickyBar,
} from '../components/ui';
import {
  dayNumber,
  groupSlotsBySession,
  slotDurationLabel,
  weekdayShort,
} from '../mocks/stitch';

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
 * Layar Venue Detail (BK-04, Stitch UX-03): hero gradasi + court pills +
 * date strip + legenda + sesi grup + slot cards + sticky total.
 * Plus Rating & Review section (SM-08, di bawah slot).
 *
 * - FOTO ASLI belum ada -> fallback gradasi + inisial, JANGAN foto palsu.
 * - Sewa alat & fasilitas DISEMBUNYIKAN (butuh ST-10).
 */
// TODO(ST-10): tampilkan section sewa alat & fasilitas dari API.
// TODO(ST-01): ganti hero gradasi dengan foto asli venue.
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
  /** Slot terpilih lokal (display-only); request booking tetap 1 slot real via onBook. */
  const [selectedStart, setSelectedStart] = useState<string | null>(null);

  // Rating hooks
  const { summary, loading: summaryLoading, error: summaryError, refetch: refetchSummary } = useVenueRatingSummary(
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

  const freeCount = slots.filter(isBookable).length;
  const selectedSlot = slots.find((s) => s.start === selectedStart && isBookable(s)) ?? null;
  // Nominal sticky HARUS dari server: tarif per jam court yg dipilih.
  const stickyTotal = court ? formatIDR(court.pricePerHour) : formatIDR(0);
  const { pagi, malam } = groupSlotsBySession(slots);

  const toggleSlot = (s: SlotItem) => {
    if (!isBookable(s)) return;
    setSelectedStart((prev) => (prev === s.start ? null : s.start));
  };

  const renderSlotCard = (s: SlotItem) => {
    const taken = !isBookable(s);
    const selected = selectedSlot?.start === s.start;
    return (
      <TouchableOpacity
        key={s.start}
        style={[
          styles.slotCard,
          taken && styles.slotTaken,
          selected && styles.slotSelected,
        ]}
        onPress={() => toggleSlot(s)}
        disabled={taken}
        accessibilityRole="button"
        accessibilityLabel={`Slot ${s.start} sampai ${s.end}, ${taken ? 'penuh' : formatIDR(court?.pricePerHour ?? 0)}`}
        accessibilityState={{ selected, disabled: taken }}
      >
        {selected ? (
          <View style={styles.slotCheck} accessibilityElementsHidden>
            <Text style={styles.slotCheckText}>✓</Text>
          </View>
        ) : null}
        <View style={styles.slotTop}>
          <Text style={[styles.slotTime, taken && styles.slotTimeTaken, selected && styles.slotTimeSelected]}>
            {s.start}
          </Text>
          {taken ? (
            <Text style={styles.slotLock} accessibilityElementsHidden>
              🔒
            </Text>
          ) : (
            <View
              style={[styles.slotDot, selected && styles.slotDotSelected]}
              accessibilityElementsHidden
            />
          )}
        </View>
        <View>
          <Text
            style={[
              styles.slotPrice,
              taken && styles.slotPriceTaken,
              selected && styles.slotPriceSelected,
            ]}
          >
            {court ? formatIDR(court.pricePerHour) : '—'}
          </Text>
          <Text
            style={[
              styles.slotDur,
              taken && styles.slotPriceTaken,
              selected && styles.slotPriceSelected,
            ]}
          >
            {taken ? (s.status === 'held' ? 'Ditahan' : s.status === 'blocked' ? 'Ditutup' : 'Penuh') : selected ? 'Terpilih' : slotDurationLabel(s)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSession = (title: string, meta: string, list: SlotItem[], prime: boolean) => {
    if (list.length === 0) return null;
    return (
      <View style={styles.session}>
        <View style={styles.sessionHead}>
          <Text style={styles.sessionTitle}>{title}</Text>
          <View style={styles.sessionMetaRow}>
            {prime ? (
              <View style={styles.primeTag} accessibilityLabel="Sesi paling favorit">
                <Text style={styles.primeTagText}>Paling Favorit</Text>
              </View>
            ) : null}
            <Text style={styles.sessionMeta}>{meta}</Text>
          </View>
        </View>
        <View style={styles.slotGrid}>{list.map(renderSlotCard)}</View>
      </View>
    );
  };

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

  if (loading && !venue) {
    return (
      <View style={styles.box}>
        <UISkeleton rows={5} />
      </View>
    );
  }

  return (
    <View style={styles.box}>
      {venue ? (
        <>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollPad}>
            {/* Hero: gradasi hijau + inisial + badge rating real */}
            <View style={styles.hero} accessibilityRole="header">
              <TouchableOpacity
                onPress={onBack}
                style={styles.heroBack}
                accessibilityRole="button"
                accessibilityLabel="Kembali ke daftar venue"
              >
                <Text style={styles.heroBackText}>‹ Kembali</Text>
              </TouchableOpacity>
              <View style={styles.heroRow}>
                <View style={styles.heroAvatar} accessibilityElementsHidden>
                  <Text style={styles.heroAvatarText}>{initialsOf(venue.name)}</Text>
                </View>
                <View style={styles.heroHead}>
                  <View style={styles.heroBadges}>
                    {summary && summary.totalRatings > 0 ? (
                      <View style={styles.ratingBadge} accessibilityLabel={`Rating ${summary.averageScore.toFixed(1)} dari ${summary.totalRatings} ulasan`}>
                        <Text style={styles.ratingBadgeText}>
                          ★ {summary.averageScore.toFixed(1)}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.newBadge} accessibilityLabel="Venue baru, belum ada ulasan">
                        <Text style={styles.newBadgeText}>Venue baru</Text>
                      </View>
                    )}
                    {summary && summary.totalRatings > 0 ? (
                      <Text style={styles.heroReviewCount}>({summary.totalRatings} ulasan)</Text>
                    ) : null}
                  </View>
                  <Text style={styles.heroName}>{venue.name}</Text>
                  <Text style={styles.heroSub} numberOfLines={2}>
                    {venue.sports.join(', ')} • {venue.address}
                  </Text>
                  {venue.distanceMeters != null ? (
                    <Text style={styles.heroDist}>{formatKm(venue.distanceMeters)} dari lokasimu</Text>
                  ) : null}
                </View>
              </View>
            </View>

            {/* Court pills horizontal */}
            <UISectionTitle>Pilih Lapangan</UISectionTitle>
            {courts.length === 0 ? (
              <Text style={styles.sub}>Tidak ada lapangan aktif.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.courtRow}>
                  {courts.map((c) => {
                    const active = court?.id === c.id;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={[styles.courtPill, active && styles.courtPillActive]}
                        onPress={() => {
                          onCourtChange(c);
                          setSelectedStart(null);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Lapangan ${c.name}, ${formatIDR(c.pricePerHour)} per jam`}
                        accessibilityState={{ selected: active }}
                      >
                        {active ? <View style={styles.courtDot} accessibilityElementsHidden /> : null}
                        <View>
                          <Text style={[styles.courtName, active && styles.courtNameActive]}>
                            {c.name}
                          </Text>
                          <Text style={[styles.courtPrice, active && styles.courtPriceActive]}>
                            {formatIDR(c.pricePerHour)}/jam
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            )}

            {/* Date strip + dot availability */}
            <View style={styles.dateHead}>
              <UISectionTitle>Pilih Tanggal Main</UISectionTitle>
              <Text style={styles.dateLabel}>{formatDateShort(date)}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.dateRow}>
                {dateOptions.map((d) => {
                  const active = d === date;
                  const isCurrent = d === date;
                  const dotColor = !isCurrent
                    ? COLORS.line
                    : freeCount === 0
                      ? COLORS.faint
                      : freeCount <= 3
                        ? COLORS.accent
                        : COLORS.brand600;
                  return (
                    <TouchableOpacity
                      key={d}
                      style={[styles.dateCard, active && styles.dateCardActive]}
                      onPress={() => {
                        onDateChange(d);
                        setSelectedStart(null);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Tanggal ${formatDateShort(d)}`}
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.dateWeek, active && styles.dateTextActive]}>
                        {weekdayShort(d)}
                      </Text>
                      <Text style={[styles.dateNum, active && styles.dateTextActive]}>
                        {dayNumber(d)}
                      </Text>
                      <View
                        style={[styles.dateDot, { backgroundColor: active ? COLORS.lime : dotColor }]}
                        accessibilityElementsHidden
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Legenda */}
            <View style={styles.legend} accessibilityRole="text">
              <View style={styles.legendItem}>
                <View style={styles.legendBox} />
                <Text style={styles.legendText}>Tersedia</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendBox, styles.legendBoxSelected]}>
                  <Text style={styles.legendCheck}>✓</Text>
                </View>
                <Text style={[styles.legendText, styles.legendTextSelected]}>
                  Terpilih{selectedSlot ? ' (1)' : ''}
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendBox, styles.legendBoxTaken]} />
                <Text style={styles.legendText}>Terisi / Penuh</Text>
              </View>
            </View>

            {/* Slot per sesi */}
            <UISectionTitle>Slot</UISectionTitle>
            {slotsLoading ? (
              <ActivityIndicator accessibilityLabel="Memuat slot" />
            ) : slots.length === 0 ? (
              <Text style={styles.sub}>Tidak ada slot di tanggal ini.</Text>
            ) : (
              <>
                {renderSession('Sesi Pagi', '07:00 - 12:00 WIB', pagi, false)}
                {renderSession('Sesi Malam', 'Prime Time', malam, true)}
              </>
            )}
            <UIErrorBanner message={slotsError} />
            <UIErrorBanner message={bookError} />

            {/* TODO(ST-10): section sewa alat & fasilitas DISEMBUNYIKAN sampai API ada. */}

            {/* Rating & Review Section (di bawah slot) */}
            {renderRatingSection()}
          </ScrollView>

          {/* Sticky bottom: total real + Lanjut Bayar oranye */}
          {selectedSlot && court ? (
            <UIStickyBar
              totalLabel="Total Bayar"
              totalValue={stickyTotal}
              totalSub={`${formatDateShort(date)} • ${selectedSlot.start}–${selectedSlot.end}`}
              ctaTitle="Lanjut Bayar"
              onCta={() => onBook(selectedSlot)}
              ctaLoading={bookingStart != null}
              ctaA11y={`Lanjut bayar slot ${selectedSlot.start}, total ${stickyTotal}`}
            />
          ) : null}
        </>
      ) : null}
      {error ? (
        <View style={styles.errPad}>
          <UIErrorBanner message={error} actionLabel="Kembali" onAction={onBack} />
        </View>
      ) : null}

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
          onClose={() => {
            setShowAllReviews(false);
            refetchSummary?.();
          }}
          currentUserId={user?.id ?? null}
          courtId={court?.id ?? null}
          courtName={court?.name}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1 },
  scrollPad: { paddingHorizontal: SPACING.screen, paddingBottom: SPACING.screen },
  errPad: { paddingHorizontal: SPACING.screen, paddingBottom: SPACING.screen },
  hero: {
    backgroundColor: HERO.from,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginTop: SPACING.screen,
  },
  heroBack: { minHeight: 44, justifyContent: 'center', marginBottom: SPACING.sm },
  heroBackText: { fontSize: 15, fontWeight: '700', color: COLORS.lime },
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  heroAvatar: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: HERO.to,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  heroAvatarText: { color: COLORS.lime, fontSize: 24, fontWeight: '800' },
  heroHead: { flex: 1 },
  heroBadges: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  ratingBadge: {
    backgroundColor: COLORS.lime,
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  ratingBadgeText: { fontSize: 12, fontWeight: '800', color: COLORS.brand950 },
  newBadge: {
    backgroundColor: COLORS.brand100,
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  newBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.brand900 },
  heroReviewCount: { fontSize: 12, color: COLORS.bg, marginLeft: SPACING.sm, opacity: 0.85 },
  heroName: { fontSize: 18, fontWeight: '800', color: COLORS.bg },
  heroSub: { fontSize: 13, color: COLORS.bg, marginTop: 2, opacity: 0.9 },
  heroDist: { fontSize: 12, fontWeight: '700', color: COLORS.lime, marginTop: 4 },
  sub: { fontSize: 14, color: COLORS.muted, marginTop: 6 },
  section: { ...TYPO.section, color: COLORS.ink, marginTop: SPACING.lg, marginBottom: SPACING.sm },
  courtRow: { flexDirection: 'row', paddingBottom: SPACING.xs },
  courtPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    marginRight: SPACING.sm,
    backgroundColor: COLORS.bg,
    minHeight: 56,
  },
  courtPillActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  courtDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.lime, marginRight: 6 },
  courtName: { fontSize: 13, fontWeight: '700', color: COLORS.ink },
  courtNameActive: { color: COLORS.bg },
  courtPrice: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  courtPriceActive: { color: COLORS.lime },
  dateHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateLabel: { fontSize: 12, fontWeight: '700', color: COLORS.brand700, marginTop: SPACING.lg },
  dateRow: { flexDirection: 'row', paddingBottom: SPACING.xs },
  dateCard: {
    width: 60,
    minHeight: 78,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.line,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  dateCardActive: { backgroundColor: COLORS.brand700, borderColor: COLORS.brand700 },
  dateWeek: { fontSize: 10, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase' },
  dateNum: { fontSize: 20, fontWeight: '800', color: COLORS.ink, marginVertical: 2 },
  dateTextActive: { color: COLORS.bg },
  dateDot: { width: 6, height: 6, borderRadius: 3, marginTop: 2 },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: COLORS.bgAlt,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    marginTop: SPACING.md,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendBox: {
    width: 14,
    height: 14,
    borderRadius: 4,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendBoxSelected: { backgroundColor: COLORS.brand700, borderColor: COLORS.brand700 },
  legendBoxTaken: { backgroundColor: COLORS.line, borderColor: COLORS.line },
  legendCheck: { fontSize: 9, fontWeight: '800', color: COLORS.bg },
  legendText: { fontSize: 12, fontWeight: '600', color: COLORS.muted, marginLeft: 6 },
  legendTextSelected: { color: COLORS.brand700, fontWeight: '800' },
  session: { marginTop: SPACING.md },
  sessionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  sessionTitle: { ...TYPO.section, color: COLORS.ink },
  sessionMetaRow: { flexDirection: 'row', alignItems: 'center' },
  sessionMeta: { fontSize: 12, color: COLORS.muted },
  primeTag: {
    backgroundColor: COLORS.accentSoft,
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 6,
  },
  primeTagText: { fontSize: 10, fontWeight: '800', color: COLORS.accent },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  slotCard: {
    width: '31%',
    margin: '1%',
    minHeight: 84,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: SPACING.md,
    justifyContent: 'space-between',
  },
  slotTaken: { backgroundColor: COLORS.expiredBg, borderColor: COLORS.expiredBg },
  slotSelected: { backgroundColor: COLORS.brand700, borderColor: COLORS.brand700 },
  slotCheck: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotCheckText: { fontSize: 13, fontWeight: '800', color: COLORS.brand950 },
  slotTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  slotTime: { fontSize: 13, fontWeight: '800', color: COLORS.ink },
  slotTimeTaken: { color: COLORS.faint, textDecorationLine: 'line-through' },
  slotTimeSelected: { color: COLORS.bg },
  slotLock: { fontSize: 13 },
  slotDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.brand600 },
  slotDotSelected: { backgroundColor: COLORS.lime },
  slotPrice: { fontSize: 12, fontWeight: '800', color: COLORS.brand700, marginTop: 6 },
  slotPriceTaken: { color: COLORS.faint, textDecorationLine: 'line-through' },
  slotPriceSelected: { color: COLORS.lime, textDecorationLine: 'none' },
  slotDur: { fontSize: 11, color: COLORS.muted, marginTop: 2 },

  /* Rating & Review styles (dipertahankan dari versi sebelumnya) */
  ratingSection: {
    marginTop: SPACING.lg,
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
  },
  ratingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  seeAllButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    minHeight: 44,
    justifyContent: 'center',
  },
  seeAllText: {
    fontSize: 13,
    color: COLORS.brand700,
    fontWeight: '600',
  },
  ratingLoader: {
    marginVertical: SPACING.lg,
  },
  ratingSummary: {
    backgroundColor: COLORS.bgAlt,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
  },
  ratingMain: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  averageScore: {
    fontSize: 36,
    fontWeight: '700',
    color: COLORS.ink,
    marginRight: SPACING.sm,
  },
  totalReviews: {
    fontSize: 14,
    color: COLORS.faint,
    marginLeft: SPACING.sm,
  },
  miniBars: {
    gap: SPACING.xs,
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
    color: COLORS.faint,
  },
  miniBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: COLORS.line,
    borderRadius: 3,
    overflow: 'hidden',
  },
  miniBarFill: {
    height: '100%',
    backgroundColor: COLORS.star,
    borderRadius: 3,
  },
  noReviews: {
    fontSize: 14,
    color: COLORS.faint,
    textAlign: 'center',
    paddingVertical: SPACING.lg,
  },
  writeReviewButton: {
    marginTop: SPACING.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    backgroundColor: COLORS.brand700,
    borderRadius: RADIUS.full,
    alignSelf: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  writeReviewText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.bg,
  },
  alreadyReviewed: {
    marginTop: SPACING.lg,
    fontSize: 13,
    color: COLORS.faint,
    textAlign: 'center',
  },
  error: { color: COLORS.danger, marginTop: SPACING.sm, textAlign: 'center' },
});

/** Badge status slot kecil (dipakai bila perlu di luar kartu). */
export function SlotStatusBadge({ status }: { status: SlotItem['status'] }) {
  const kind = status === 'free' ? 'open' : status === 'held' ? 'pending' : 'full';
  const label =
    status === 'free'
      ? 'Tersedia'
      : status === 'held'
        ? 'Ditahan'
        : status === 'blocked'
          ? 'Ditutup'
          : 'Penuh';
  return <UIBadge kind={kind} label={label} />;
}
