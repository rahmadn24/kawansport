import React from 'react';
import { FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SPORT_SUGGESTIONS, SportEventItem, slotsLeft } from '../api/events';
import { COLORS, SPACING, TYPO, formatKm, formatWIB, friendlyServerError } from '../theme';
import {
  UIAppBar,
  UIBadge,
  UIButton,
  UIEmptyState,
  UIErrorBanner,
  UISkeleton,
} from '../components/ui';

interface Props {
  events: SportEventItem[];
  loading: boolean;
  error: string | null;
  sportFilter: string | null;
  onFilterChange: (sport: string | null) => void;
  onRefresh: () => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
}

/** Layar Event List (SM-04): filter sport chips + daftar sort datetime ASC. */
export function EventListScreen({
  events,
  loading,
  error,
  sportFilter,
  onFilterChange,
  onRefresh,
  onSelect,
  onCreate,
}: Props) {
  const firstLoad = loading && events.length === 0;
  return (
    <View style={styles.screen}>
      <View style={styles.padded}>
        <UIAppBar
          title="Event"
          right={
            <TouchableOpacity
              onPress={onRefresh}
              style={styles.refresh}
              accessibilityRole="button"
              accessibilityLabel="Muat ulang daftar event"
            >
              <Text style={styles.refreshText}>⟳ Muat ulang</Text>
            </TouchableOpacity>
          }
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
          <TouchableOpacity
            style={[styles.chip, !sportFilter && styles.chipActive]}
            onPress={() => onFilterChange(null)}
            accessibilityRole="button"
            accessibilityLabel="Saring Semua olahraga"
            accessibilityState={{ selected: !sportFilter }}
          >
            <Text style={[styles.chipText, !sportFilter && styles.chipTextActive]}>Semua</Text>
          </TouchableOpacity>
          {SPORT_SUGGESTIONS.map((s) => {
            const active = sportFilter?.toLowerCase() === s.toLowerCase();
            return (
              <TouchableOpacity
                key={s}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => onFilterChange(active ? null : s)}
                accessibilityRole="button"
                accessibilityLabel={`Saring olahraga ${s}`}
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{s}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={styles.meta} accessibilityRole="text">
          {events.length > 0
            ? `${events.length} event${sportFilter ? ` • ${sportFilter}` : ''}`
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
          data={events}
          keyExtractor={(item) => item.id}
          onRefresh={onRefresh}
          refreshing={loading}
          ListEmptyComponent={
            <UIEmptyState
              illustration="⚽"
              title="Belum ada event"
              message="Jadilah yang pertama bikin keseruan. Ajak kawanmu main bareng!"
              actionLabel="Buat Event"
              onAction={onCreate}
              actionA11y="Buat event pertama"
            />
          }
          renderItem={({ item }) => {
            const left = slotsLeft(item);
            const hostName = item.host.displayName || item.host.email;
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => onSelect(item.id)}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}, ${item.status === 'open' ? 'buka' : 'penuh'}, sisa ${left} dari ${item.capacity} slot`}
              >
                <View style={styles.cardRow}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <UIBadge kind={item.status === 'open' ? 'open' : 'full'} label={item.status === 'open' ? 'OPEN' : 'FULL'} icon={item.status === 'open' ? '●' : '■'} />
                </View>
                <Text style={styles.cardSub}>
                  {item.sport} • {formatWIB(item.datetime)}
                </Text>
                <Text style={styles.cardSub}>
                  Sisa {left} dari {item.capacity}
                  {item.distanceMeters != null ? ` • ${formatKm(item.distanceMeters)}` : ''}
                </Text>
                <Text style={styles.cardHost}>Sapa: {hostName} 👋</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {events.length > 0 ? (
        <View style={styles.fabWrap}>
          <UIButton title="＋ Buat Event" variant="accent" onPress={onCreate} accessibilityLabel="Buat event baru" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  padded: { paddingHorizontal: SPACING.screen, paddingTop: SPACING.screen },
  list: { flex: 1 },
  listContent: { paddingHorizontal: SPACING.screen, paddingBottom: 100 },
  chipsRow: { flexDirection: 'row', marginBottom: SPACING.sm },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 9999,
    paddingHorizontal: SPACING.md,
    minHeight: 40,
    justifyContent: 'center',
    marginRight: SPACING.sm,
    backgroundColor: COLORS.bg,
  },
  chipActive: { backgroundColor: COLORS.brand700, borderColor: COLORS.brand700 },
  chipText: { ...TYPO.chip, color: COLORS.muted },
  chipTextActive: { color: COLORS.bg },
  meta: { fontSize: 13, color: COLORS.muted, marginBottom: SPACING.sm },
  card: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 20,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { ...TYPO.cardTitle, color: COLORS.ink, flex: 1, marginRight: SPACING.sm },
  cardSub: { fontSize: 13, color: COLORS.muted, marginTop: SPACING.xs },
  cardHost: { fontSize: 13, color: COLORS.brand700, fontWeight: '600', marginTop: SPACING.sm },
  fabWrap: {
    position: 'absolute',
    left: SPACING.screen,
    right: SPACING.screen,
    bottom: SPACING.screen,
  },
  refresh: { minHeight: 44, justifyContent: 'center' },
  refreshText: { fontSize: 14, fontWeight: '700', color: COLORS.brand700 },
});
