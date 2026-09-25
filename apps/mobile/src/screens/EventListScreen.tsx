import React, { useState } from 'react';
import { FlatList, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SPORT_SUGGESTIONS, SportEventItem, slotsLeft } from '../api/events';
import { firstPhoto, resolvePhotoUrl } from '../api/photos';
import { PromoItem, hasLivePromos } from '../api/promos';
import { COLORS, RADIUS, SPACING, TYPO, formatKm, formatWIB, friendlyServerError } from '../theme';
import {
  UIAvatar,
  UIBadge,
  UIButton,
  UIEmptyState,
  UIErrorBanner,
  UIHeader,
  UISearchBar,
  UISkeleton,
  UISportChips,
} from '../components/ui';
import { sportIconOf } from '../mocks/stitch';

interface Props {
  events: SportEventItem[];
  loading: boolean;
  error: string | null;
  sportFilter: string | null;
  onFilterChange: (sport: string | null) => void;
  onRefresh: () => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
  /** GAP-01: bell -> kotak masuk notifikasi (ganti Alert GAP-01). */
  onBellPress?: () => void;
  /**
   * ST-09: banner promo CMS real (GET /promos). Kosong/undefined =
   * DISEMBUNYIKAN (bukan placeholder palsu) — jangan render data statis.
   */
  promos?: PromoItem[];
}

// TODO(ST-09-map): peta dari API search belum ada — react-native-maps butuh
// native rebuild tak terverifikasi; daftar nearby ada di tab Cari (SearchScreen).
// ST-09 SELESAI: banner event = promo CMS real (props `promos`); kosong = sembunyi.
// TODO(ST-03): waiting list — tombol "Antre" DISABLED sampai API ada.
// TODO(ST-02): biaya event per orang dari API event berbayar (saat ini disembunyikan).

/** Layar Event feed (SM-04, gaya Stitch): search lokal + chip navy + banner + kartu kaya. */
export function EventListScreen({
  events,
  loading,
  error,
  sportFilter,
  onFilterChange,
  onRefresh,
  onSelect,
  onCreate,
  onBellPress,
  promos,
}: Props) {
  const [query, setQuery] = useState('');
  const firstLoad = loading && events.length === 0;

  // Filter lokal display-only (tak mengubah request server).
  const q = query.trim().toLowerCase();
  const visible = q
    ? events.filter((e) =>
        `${e.title} ${e.sport} ${e.host.displayName ?? ''} ${e.host.email}`.toLowerCase().includes(q),
      )
    : events;

  return (
    <View style={styles.screen}>
      <UIHeader locationText="Sekitarmu" onBellPress={onBellPress} />
      <View style={styles.padded}>
        <UISearchBar
          value={query}
          onChange={setQuery}
          placeholder="Cari mabar, olahraga, host…"
          accessibilityLabel="Cari event di daftar ini"
        />
        <UISportChips sports={SPORT_SUGGESTIONS} value={sportFilter} onChange={onFilterChange} />

        {hasLivePromos(promos) ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.promoStrip}
            contentContainerStyle={styles.promoStripContent}
            accessibilityLabel="Promo dari KawanSport"
          >
            {(promos ?? []).map((promo) => {
              const uri = resolvePhotoUrl(promo.imageUrl);
              return (
                <View key={promo.id} style={styles.banner} accessibilityLabel={`Promo: ${promo.title}`}>
                  {uri ? (
                    <Image
                      source={{ uri }}
                      style={styles.bannerPhoto}
                      accessibilityRole="image"
                      accessibilityLabel={`Gambar ${promo.title}`}
                    />
                  ) : null}
                  <View style={styles.bannerBody}>
                    <Text style={styles.bannerEyebrow}>🎟 PROMO</Text>
                    <Text style={styles.bannerTitle}>{promo.title}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        ) : null}

        <Text style={styles.meta} accessibilityRole="text">
          {visible.length > 0
            ? `${visible.length} event${sportFilter ? ` • ${sportFilter}` : ''}`
            : 'Mencari event seru…'}
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
          data={visible}
          keyExtractor={(item) => item.id}
          onRefresh={onRefresh}
          refreshing={loading}
          ListEmptyComponent={
            <UIEmptyState
              illustration="⚽"
              title={q ? 'Tidak ketemu' : 'Belum ada event'}
              message={
                q
                  ? 'Coba kata kunci lain atau ganti filter olahragamu.'
                  : 'Jadilah yang pertama bikin keseruan. Ketuk tombol "Buat Mabar" di bawah!'
              }
            />
          }
          renderItem={({ item }) => {
            const left = slotsLeft(item);
            const full = item.status !== 'open';
            const hostName = item.host.displayName || item.host.email;
            const fillPct = Math.min(100, Math.round((item.participantsCount / Math.max(1, item.capacity)) * 100));
            const lowSlot = !full && left <= 3;
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => onSelect(item.id)}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}, ${full ? 'penuh' : 'buka'}, sisa ${left} dari ${item.capacity} slot`}
              >
                {/* ST-01: foto pertama event bila ada, else ikon olahraga. */}
                {(() => {
                  const thumb = firstPhoto(item.photos);
                  return thumb ? (
                    <Image
                      source={{ uri: resolvePhotoUrl(thumb) }}
                      style={styles.thumbPhoto}
                      accessibilityRole="image"
                      accessibilityLabel={`Foto ${item.title}`}
                    />
                  ) : (
                    <View style={styles.thumb} accessibilityElementsHidden>
                      <Text style={styles.thumbText}>{sportIconOf(item.sport)}</Text>
                    </View>
                  );
                })()}
                <View style={styles.cardRow}>
                  <View style={styles.badgeRow}>
                    <UIBadge kind={full ? 'full' : 'open'} label={full ? 'FULL' : 'BUKA'} icon={full ? '■' : '●'} />
                    <View style={styles.sportPill}>
                      <Text style={styles.sportPillText}>
                        {sportIconOf(item.sport)} {item.sport}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                </View>
                <Text style={styles.cardSub}>
                  🗓 {formatWIB(item.datetime)}
                </Text>
                <Text style={styles.cardSub}>
                  {item.distanceMeters != null ? `📍 ${formatKm(item.distanceMeters)} • ` : ''}
                  Sisa {left} dari {item.capacity}
                </Text>
                <View style={styles.progress} accessibilityElementsHidden>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${fillPct}%` },
                      lowSlot && styles.progressFillLow,
                    ]}
                  />
                </View>
                <View style={styles.hostRow}>
                  <UIAvatar name={item.host.displayName} email={item.host.email} uri={item.host.avatarUrl} size={36} />
                  <View style={styles.hostInfo}>
                    <Text style={styles.cardHost} numberOfLines={1}>
                      {hostName} 👋
                    </Text>
                    <Text style={styles.hostSub}>Host event</Text>
                  </View>
                </View>
                {full ? (
                  <View style={styles.joinBtn}>
                    <UIButton
                      title="Antre"
                      variant="outline"
                      onPress={() => undefined}
                      disabled
                      accessibilityLabel="Event penuh, antre segera hadir"
                    />
                  </View>
                ) : (
                  <View style={styles.joinBtn}>
                    <UIButton
                      title={lowSlot ? `Gabung — sisa ${left}!` : 'Gabung'}
                      variant="accent"
                      onPress={() => onSelect(item.id)}
                      accessibilityLabel={`Lihat event ${item.title} dan gabung`}
                    />
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/*
        FAB Stitch events feed: pill oranye kompak rata kanan (h-12, pl-4 pr-5,
        label 14 bold + ikon), bukan bar full-width raksasa.
      */}
      <View style={styles.fabWrap}>
        <UIButton
          title="＋ Buat Mabar"
          variant="accent"
          onPress={onCreate}
          accessibilityLabel="Buat event baru"
          style={styles.fabBtn}
          textStyle={styles.fabBtnText}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  padded: { paddingHorizontal: SPACING.screen, paddingTop: SPACING.md },
  promoStrip: { marginTop: SPACING.sm, marginBottom: SPACING.sm },
  promoStripContent: { paddingRight: SPACING.screen },
  banner: {
    backgroundColor: COLORS.navy,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginRight: SPACING.sm,
    width: 280,
  },
  bannerPhoto: {
    height: 96,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.brand900,
    marginBottom: SPACING.sm,
  },
  bannerBody: {},
  bannerEyebrow: { fontSize: 12, fontWeight: '800', color: COLORS.lime },
  bannerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.bg, marginTop: 4 },
  bannerMsg: { fontSize: 13, color: COLORS.bg, marginTop: 4, lineHeight: 20, opacity: 0.9 },
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
  thumb: {
    height: 88,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.brand900,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  thumbText: { fontSize: 40 },
  thumbPhoto: {
    height: 88,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.line,
    marginBottom: SPACING.md,
  },
  cardRow: { marginBottom: 2 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  sportPill: {
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.bgAlt,
    borderWidth: 1,
    borderColor: COLORS.line,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    marginLeft: SPACING.sm,
  },
  sportPillText: { fontSize: 12, fontWeight: '700', color: COLORS.muted },
  cardTitle: { ...TYPO.cardTitle, color: COLORS.ink },
  cardSub: { fontSize: 13, color: COLORS.muted, marginTop: SPACING.xs },
  progress: { height: 8, borderRadius: 4, backgroundColor: COLORS.line, marginTop: SPACING.sm, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: COLORS.brand600 },
  progressFillLow: { backgroundColor: COLORS.accent },
  hostRow: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.md },
  hostInfo: { flex: 1, marginLeft: SPACING.sm },
  cardHost: { fontSize: 14, color: COLORS.ink, fontWeight: '700' },
  hostSub: { fontSize: 12, color: COLORS.faint, marginTop: 2 },
  joinBtn: { marginTop: SPACING.md },
  // FAB kompak Stitch (code.html: fixed bottom-20 right-4, h-12 pl-4 pr-5
  // rounded-full oranye): lebar mengikuti konten, rata kanan, tinggi 48.
  fabWrap: {
    position: 'absolute',
    right: SPACING.screen,
    bottom: SPACING.screen,
    alignItems: 'flex-end',
  },
  fabBtn: {
    alignSelf: 'auto',
    flexGrow: 0,
    minHeight: 48,
    paddingHorizontal: SPACING.screen,
    paddingVertical: SPACING.md,
  },
  fabBtnText: { fontSize: 14 },
});
