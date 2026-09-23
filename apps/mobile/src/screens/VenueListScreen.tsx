import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { VenueItem } from '../api/venues';
import { formatDistance } from '../api/partners';
import { formatIDR } from '../api/bookings';
import { COLORS, RADIUS, SPACING, TYPO, formatKm, initialsOf } from '../theme';
import { SPORT_SUGGESTIONS } from '../api/profile';
import {
  UIEmptyState,
  UIErrorBanner,
  UIHeader,
  UISearchBar,
  UISkeleton,
  UISportChips,
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

/** Layar Venue List (BK-04, Stitch UX-03): search lokal + filter sport + kartu kaya. */
// TODO(ST-06): rating venue di kartu DISEMBUNYIKAN sampai API rating tersedia.
// TODO(ST-01): ganti thumb gradasi dengan foto asli venue.
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
  const [query, setQuery] = useState('');
  // Filter lokal display-only (tak mengubah request server).
  const q = query.trim().toLowerCase();
  const visible = q
    ? venues.filter((v) =>
        `${v.name} ${v.address} ${v.sports.join(' ')}`.toLowerCase().includes(q),
      )
    : venues;
  return (
    <View style={styles.screen}>
      <UIHeader locationText="Sekitarmu" />
      <View style={styles.content}>
        {eventLabel ? (
          <View style={styles.ctx} accessibilityRole="text">
            <Text style={styles.ctxText}>Booking untuk: {eventLabel}</Text>
          </View>
        ) : null}

        <UISearchBar
          value={query}
          onChange={setQuery}
          placeholder="Cari venue, alamat, olahraga…"
          accessibilityLabel="Cari venue di daftar ini"
        />

        <UISportChips sports={SPORT_SUGGESTIONS} value={sportFilter} onChange={onFilterChange} />

        {loading && venues.length === 0 ? (
          <UISkeleton rows={4} />
        ) : (
          <FlatList
            style={styles.list}
            contentContainerStyle={styles.listPad}
            data={visible}
            keyExtractor={(item) => item.id}
            onRefresh={onRefresh}
            refreshing={loading}
            ListEmptyComponent={
              <UIEmptyState
                illustration="🏟"
                title={q ? 'Tidak ketemu' : 'Belum ada venue'}
                message={
                  q
                    ? 'Coba kata kunci lain atau ganti filter olahragamu.'
                    : 'Coba ganti filter olahraga atau muat ulang daftar.'
                }
                actionLabel={q ? undefined : 'Muat Ulang'}
                onAction={q ? undefined : onRefresh}
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
                      {/* TODO(ST-06): rating venue DISEMBUNYIKAN sampai API rating ada. */}
                      <Text style={styles.cardSub} numberOfLines={1}>
                        {item.sports.join(' • ')}
                      </Text>
                      <Text style={styles.cardSub} numberOfLines={1}>
                        📍 {item.address}
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  content: { flex: 1, paddingHorizontal: SPACING.screen },
  ctx: {
    backgroundColor: COLORS.brand100,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  ctxText: { fontSize: 13, fontWeight: '600', color: COLORS.brand900, textAlign: 'center' },
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
