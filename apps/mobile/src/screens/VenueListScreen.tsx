import React from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { VenueItem } from '../api/venues';
import { formatDistance } from '../api/partners';
import { formatIDR } from '../api/bookings';
import { COLORS, RADIUS, SPACING, TYPO, formatKm, initialsOf } from '../theme';
import {
  UIAppBar,
  UIChip,
  UIEmptyState,
  UIErrorBanner,
  UISkeleton,
} from '../components/ui';

interface Props {
  venues: VenueItem[];
  loading: boolean;
  error: string | null;
  sportFilter: string | null;
  onFilterChange: (sport: string | null) => void;
  onRefresh: () => void;
  onSelect: (id: string) => void;
  /** Konteks event bila alur berasal dari tombol Book Court di EventDetail. */
  eventLabel: string | null;
}

const SPORTS = ['Futsal', 'Basket', 'Badminton', 'Tenis', 'Voli'];

/** Layar Venue List (BK-04, Stitch UX-03): filter sport + kartu venue. */
export function VenueListScreen({
  venues,
  loading,
  error,
  sportFilter,
  onFilterChange,
  onRefresh,
  onSelect,
  eventLabel,
}: Props) {
  return (
    <View style={styles.box}>
      <UIAppBar title="Booking Lapangan" />
      {eventLabel ? (
        <View style={styles.ctx} accessibilityRole="text">
          <Text style={styles.ctxText}>Booking untuk: {eventLabel}</Text>
        </View>
      ) : null}

      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Saring olahraga">
        <UIChip label="Semua" active={!sportFilter} onPress={() => onFilterChange(null)} />
        {SPORTS.map((s) => {
          const active = sportFilter?.toLowerCase() === s.toLowerCase();
          return (
            <UIChip
              key={s}
              label={s}
              active={active}
              onPress={() => onFilterChange(active ? null : s)}
            />
          );
        })}
      </View>

      {loading && venues.length === 0 ? (
        <UISkeleton rows={4} />
      ) : (
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listPad}
          data={venues}
          keyExtractor={(item) => item.id}
          onRefresh={onRefresh}
          refreshing={loading}
          ListEmptyComponent={
            <UIEmptyState
              illustration="🏟"
              title="Belum ada venue"
              message="Coba ganti filter olahraga atau muat ulang daftar."
              actionLabel="Muat Ulang"
              onAction={onRefresh}
            />
          }
          renderItem={({ item }) => {
            const courts = item.courts ?? [];
            const prices = courts
              .filter((c) => c.status === 'active')
              .map((c) => c.pricePerHour)
              .filter((p) => Number.isFinite(p));
            const fromPrice = prices.length > 0 ? Math.min(...prices) : null;
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => onSelect(item.id)}
                accessibilityRole="button"
                accessibilityLabel={`Buka ${item.name}`}
              >
                <View style={styles.cardTop}>
                  <View style={styles.thumb} accessibilityElementsHidden>
                    <Text style={styles.thumbText}>{initialsOf(item.name)}</Text>
                  </View>
                  <View style={styles.cardHead}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.cardSub} numberOfLines={1}>
                      {item.sports.join(', ')}
                    </Text>
                    <Text style={styles.cardSub} numberOfLines={1}>
                      {item.address}
                    </Text>
                  </View>
                </View>
                <View style={styles.cardMeta}>
                  <Text style={styles.meta}>
                    {courts.length} lapangan
                    {item.distanceMeters != null
                      ? ` • ${formatKm(item.distanceMeters)} dari lokasimu`
                      : ` • ${formatDistance(item.distanceMeters)}`}
                  </Text>
                  {fromPrice != null ? (
                    <Text style={styles.price}>Mulai {formatIDR(fromPrice)}/jam</Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <UIErrorBanner message={error} actionLabel="Coba lagi" onAction={onRefresh} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: SPACING.screen },
  ctx: {
    backgroundColor: COLORS.brand100,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  ctxText: { fontSize: 13, fontWeight: '600', color: COLORS.brand900, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: SPACING.sm },
  list: { flex: 1 },
  listPad: { paddingBottom: SPACING.screen },
  card: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.brand900,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  thumbText: { color: COLORS.lime, fontSize: 20, fontWeight: '800' },
  cardHead: { flex: 1 },
  cardTitle: { ...TYPO.cardTitle, color: COLORS.ink },
  cardSub: { ...TYPO.sub, color: COLORS.muted, marginTop: 2 },
  cardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
    paddingTop: SPACING.md,
  },
  meta: { fontSize: 12, fontWeight: '600', color: COLORS.faint },
  price: { fontSize: 13, fontWeight: '800', color: COLORS.brand700 },
});
