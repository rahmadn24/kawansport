import React from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SearchItem, searchKindIcon, searchKindLabel } from '../api/search';
import { COLORS, RADIUS, SPACING, TYPO, formatKm, friendlyServerError } from '../theme';
import {
  UIButton,
  UIEmptyState,
  UIErrorBanner,
  UIHeader,
  UISearchBar,
  UISkeleton,
} from '../components/ui';

// TODO(ST-09-map): map view BUTUH react-native-maps (native rebuild tak
// terverifikasi di repo ini) — JANGAN tambah dep native. Sementara daftar
// nearby (GET /search + geo GPS) + jarak per baris; peta visual menyusul
// bila native rebuild terverifikasi.

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  results: SearchItem[];
  total: number;
  loading: boolean;
  error: string | null;
  /** True bila hasil memakai titik geo (daftar = nearby + jarak). */
  nearbyActive: boolean;
  locating: boolean;
  locationError: string | null;
  onSubmit: () => void;
  onRefresh: () => void;
  onUseLocation: () => void;
  onClearLocation: () => void;
  onSelectVenue: (id: string) => void;
  onSelectEvent: (id: string) => void;
  /** Produk tak punya layar detail di mobile — pemanggil mengarah ke tab Shop. */
  onSelectProduct: (id: string) => void;
  /** GAP-01: bell -> kotak masuk notifikasi. */
  onBellPress?: () => void;
}

/** Layar Cari ST-09: query + hasil gabungan venue/event/produk + link ke detail. */
export function SearchScreen({
  query,
  onQueryChange,
  results,
  total,
  loading,
  error,
  nearbyActive,
  locating,
  locationError,
  onSubmit,
  onRefresh,
  onUseLocation,
  onClearLocation,
  onSelectVenue,
  onSelectEvent,
  onSelectProduct,
  onBellPress,
}: Props) {
  const firstLoad = loading && results.length === 0;
  const selectOf = (item: SearchItem) => {
    if (item.kind === 'venue') onSelectVenue(item.id);
    else if (item.kind === 'event') onSelectEvent(item.id);
    else onSelectProduct(item.id);
  };

  return (
    <View style={styles.screen}>
      <UIHeader locationText={nearbyActive ? 'Sekitarmu' : 'Semua'} onBellPress={onBellPress} />
      <View style={styles.padded}>
        <UISearchBar
          value={query}
          onChange={onQueryChange}
          placeholder="Cari venue, event, produk…"
          accessibilityLabel="Cari venue, event, dan produk"
        />
        <View style={styles.geoRow}>
          {nearbyActive ? (
            <UIButton
              title="Lokasi: aktif — tampilkan semua"
              variant="ghost"
              onPress={onClearLocation}
              accessibilityLabel="Matikan filter lokasi"
            />
          ) : (
            <UIButton
              title={locating ? 'Mencari lokasimu…' : '📍 Terdekat dariku'}
              variant="outline"
              onPress={onUseLocation}
              disabled={locating}
              accessibilityLabel="Cari yang terdekat dari lokasiku"
            />
          )}
        </View>
        {locationError ? (
          <UIErrorBanner message={locationError} actionLabel="Coba lagi" onAction={onUseLocation} />
        ) : null}
        <Text style={styles.meta} accessibilityRole="text">
          {results.length > 0
            ? `${total} hasil${nearbyActive ? ' • terdekat dulu' : ' • abjad'}`
            : 'Ketik kata kunci lalu tekan cari.'}
        </Text>
        <UIErrorBanner message={friendlyServerError(error)} actionLabel="Muat ulang" onAction={onRefresh} />
      </View>

      {firstLoad ? (
        <View style={styles.padded}>
          <UISkeleton rows={4} />
        </View>
      ) : (
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={results}
          keyExtractor={(item) => `${item.kind}:${item.id}`}
          onRefresh={onRefresh}
          refreshing={loading}
          ListEmptyComponent={
            <UIEmptyState
              illustration="🔍"
              title={query.trim() ? 'Tidak ketemu' : 'Belum ada pencarian'}
              message={
                query.trim()
                  ? 'Coba kata kunci lain (nama venue, judul event, nama produk).'
                  : 'Cari venue, mabar, atau perlengkapan — hasilnya tampil di sini.'
              }
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => selectOf(item)}
              accessibilityRole="button"
              accessibilityLabel={`${searchKindLabel(item.kind)}: ${item.title}`}
            >
              <View style={styles.cardTop}>
                <View style={styles.thumb} accessibilityElementsHidden>
                  <Text style={styles.thumbText}>{searchKindIcon(item.kind)}</Text>
                </View>
                <View style={styles.cardHead}>
                  <Text style={styles.kind}>{searchKindLabel(item.kind).toUpperCase()}</Text>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {item.subtitle ? (
                    <Text style={styles.cardSub} numberOfLines={1}>
                      {item.subtitle}
                    </Text>
                  ) : null}
                </View>
              </View>
              {item.distanceMeters != null ? (
                <Text style={styles.dist}>📍 {formatKm(item.distanceMeters)} darimu</Text>
              ) : null}
            </TouchableOpacity>
          )}
        />
      )}
      {/* Submit via tombol (UISearchBar tak mengekspos onSubmitText). */}
      <View style={styles.submitWrap}>
        <UIButton
          title={loading ? 'Mencari…' : 'Cari'}
          onPress={onSubmit}
          disabled={loading}
          accessibilityLabel="Jalankan pencarian"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  padded: { paddingHorizontal: SPACING.screen, paddingTop: SPACING.md },
  geoRow: { marginTop: SPACING.sm, marginBottom: SPACING.xs },
  meta: { fontSize: 13, color: COLORS.muted, marginBottom: SPACING.sm },
  list: { flex: 1 },
  listContent: { paddingHorizontal: SPACING.screen, paddingBottom: 100 },
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
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.brand900,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  thumbText: { fontSize: 24 },
  cardHead: { flex: 1 },
  kind: { fontSize: 11, fontWeight: '800', color: COLORS.brand700 },
  cardTitle: { ...TYPO.cardTitle, color: COLORS.ink, marginTop: 2 },
  cardSub: { ...TYPO.sub, color: COLORS.muted, marginTop: 2 },
  dist: { fontSize: 12, fontWeight: '600', color: COLORS.faint, marginTop: SPACING.sm },
  submitWrap: {
    paddingHorizontal: SPACING.screen,
    paddingBottom: SPACING.screen,
    backgroundColor: COLORS.bg,
  },
});
