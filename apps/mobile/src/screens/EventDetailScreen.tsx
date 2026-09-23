import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { EventDetail, EventParticipantItem, slotsLeft } from '../api/events';
import { bookingStatusLabel, formatIDR, formatSlotLabel } from '../api/bookings';
import { COLORS, RADIUS, SPACING, TYPO, formatWIB, friendlyServerError } from '../theme';
import {
  UIAppBar,
  UIAvatar,
  UIBadge,
  UIButton,
  UICard,
  UIEmptyState,
  UIErrorBanner,
  UISectionTitle,
  UISkeleton,
} from '../components/ui';
import { sportIconOf } from '../mocks/stitch';

interface Props {
  event: EventDetail | null;
  loading: boolean;
  error: string | null;
  participants: EventParticipantItem[];
  participantsLoading: boolean;
  /** True saat request join/leave sedang berjalan. */
  mutating: boolean;
  joinError: string | null;
  onBack: () => void;
  onRefresh: () => void;
  onJoin: () => void;
  onLeave: () => void;
  /** BK-04: buka alur booking lapangan untuk event ini. */
  onBookCourt: () => void;
}

// TODO(ST-01): ganti hero gradasi dengan foto asli event.
// TODO(ST-03): waiting list event penuh — tombolAntre DISABLED sampai API ada.
// TODO(ST-10): fasilitas venue & sewa alat DISEMBUNYIKAN sampai API ada.

/**
 * Layar Event Detail (SM-04 + SM-05, gaya Stitch): hero + info + peserta + sticky Join.
 */
export function EventDetailScreen({
  event,
  loading,
  error,
  participants,
  participantsLoading,
  mutating,
  joinError,
  onBack,
  onRefresh,
  onJoin,
  onLeave,
  onBookCourt,
}: Props) {
  const isFull = event != null && event.status === 'full' && !event.isJoined;

  const confirmLeave = () => {
    Alert.alert('Keluar dari event?', 'Slotmu akan dilepas untuk kawan lain.', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Ya, keluar', style: 'destructive', onPress: onLeave },
    ]);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.padded}>
        <UIAppBar title="Detail Event" onBack={onBack} />
      </View>
      {loading && !event ? (
        <View style={styles.padded}>
          <UISkeleton rows={3} />
        </View>
      ) : event ? (
        <>
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {/* Hero: gradasi + ikon olahraga (foto asli menyusul ST-01) */}
            <View style={styles.hero} accessibilityRole="header">
              <Text style={styles.heroIcon} accessibilityElementsHidden>
                {sportIconOf(event.sport)}
              </Text>
              <View style={styles.heroBadges}>
                <UIBadge
                  kind={event.status === 'open' ? 'open' : 'full'}
                  label={event.status === 'open' ? 'BUKA' : 'FULL'}
                  icon={event.status === 'open' ? '●' : '■'}
                />
                <View style={styles.sportPill}>
                  <Text style={styles.sportPillText}>{event.sport}</Text>
                </View>
              </View>
              <Text style={styles.heroTitle}>{event.title}</Text>
              <Text style={styles.heroMeta}>
                Sisa {slotsLeft(event)} dari {event.capacity} slot
              </Text>
            </View>

            <UICard>
              <View style={styles.hostRow}>
                <UIAvatar
                  name={event.host.displayName}
                  email={event.host.email}
                  uri={event.host.avatarUrl}
                  size={44}
                />
                <View style={styles.hostInfo}>
                  <Text style={styles.hostText} numberOfLines={1}>
                    {event.host.displayName ?? event.host.email}
                  </Text>
                  <Text style={styles.hostSub}>Host event 👑</Text>
                </View>
              </View>
              <Text style={styles.meta}>🗓 {formatWIB(event.datetime)}</Text>
              <Text style={styles.meta}>📍 Titik lokasi event sudah ditandai</Text>
              <Text style={styles.detailSub}>Rincian alamat menyusul dari host</Text>
            </UICard>

            <UISectionTitle>Info & Aturan Mabar</UISectionTitle>
            <UICard>
              {event.description ? <Text style={styles.desc}>{event.description}</Text> : null}
              {event.booking ? (
                <Text style={styles.detailLine}>
                  🏟 Lapangan: {formatSlotLabel(event.booking.date, event.booking.start, event.booking.end)} •{' '}
                  {bookingStatusLabel(event.booking.status)}
                </Text>
              ) : null}
              {event.booking ? (
                <Text style={styles.detailLine}>
                  💰 Iuran: {formatIDR(event.booking.amount)}
                </Text>
              ) : null}
            </UICard>

            <UISectionTitle>Peserta ({participants.length}/{event.capacity})</UISectionTitle>
            <UICard>
              <Text style={styles.slotText} accessibilityLabel={`Sisa ${slotsLeft(event)} dari ${event.capacity} slot`}>
                Sisa {slotsLeft(event)} dari {event.capacity} slot
              </Text>
              <View style={styles.progress} accessibilityElementsHidden>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.min(100, Math.round((event.participantsCount / Math.max(1, event.capacity)) * 100))}%` },
                    slotsLeft(event) <= 3 && styles.progressFillLow,
                  ]}
                />
              </View>
              <Text style={styles.meta}>
                {event.participantsCount}/{event.capacity} sudah gabung
              </Text>
            </UICard>

            {participantsLoading && participants.length === 0 ? (
              <UISkeleton rows={2} />
            ) : participants.length === 0 ? (
              <UIEmptyState
                illustration="🙌"
                title="Belum ada peserta"
                message="Jadilah yang pertama gabung dan ramaikan event ini!"
              />
            ) : (
              <UICard>
                {participants.map((p) => (
                  <View key={p.userId} style={styles.partRow}>
                    <UIAvatar name={p.displayName} email={p.email} uri={p.avatarUrl} size={36} />
                    <Text style={styles.partName} numberOfLines={1}>
                      {p.displayName ?? p.email}
                      {p.userId === event.host.id ? ' 👑' : ''}
                    </Text>
                    {p.userId === event.host.id ? (
                      <UIBadge kind="skill" label="Host" />
                    ) : null}
                  </View>
                ))}
              </UICard>
            )}
          </ScrollView>

          <View style={styles.sticky}>
            <UIErrorBanner message={friendlyServerError(joinError)} actionLabel="Coba lagi" onAction={event.isJoined ? onLeave : onJoin} />
            {event.isJoined ? (
              <UIButton
                title="Keluar Event"
                variant="outline"
                onPress={confirmLeave}
                loading={mutating}
                loadingTitle="Memproses…"
                accessibilityLabel="Keluar dari event"
              />
            ) : isFull ? (
              <UIButton
                title="Antre"
                variant="outline"
                onPress={() => undefined}
                disabled
                accessibilityLabel="Event penuh, antre segera hadir"
              />
            ) : (
              <UIButton
                title={`Gabung Mabar${slotsLeft(event) <= 3 ? ` — sisa ${slotsLeft(event)}!` : ''}`}
                variant="accent"
                onPress={onJoin}
                loading={mutating}
                loadingTitle="Memproses…"
                accessibilityLabel="Gabung event ini"
              />
            )}
            <View style={styles.gap} />
            <UIButton title="Pesan Lapangan" variant="ghost" onPress={onBookCourt} accessibilityLabel="Pesan lapangan untuk event ini" />
          </View>
        </>
      ) : null}
      <View style={styles.padded}>
        <UIErrorBanner message={friendlyServerError(error)} actionLabel="Coba lagi" onAction={onRefresh} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  padded: { paddingHorizontal: SPACING.screen, paddingTop: SPACING.screen },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: SPACING.screen, paddingBottom: SPACING.lg },
  hero: {
    backgroundColor: COLORS.brand900,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    alignItems: 'center',
  },
  heroIcon: { fontSize: 56, marginBottom: SPACING.sm },
  heroBadges: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  sportPill: {
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.navy,
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    marginLeft: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.lime,
  },
  sportPillText: { fontSize: 12, fontWeight: '700', color: COLORS.bg },
  heroTitle: { fontSize: 20, fontWeight: '800', color: COLORS.bg, textAlign: 'center' },
  heroMeta: { fontSize: 14, fontWeight: '700', color: COLORS.lime, marginTop: SPACING.sm },
  meta: { fontSize: 13, color: COLORS.muted, marginTop: SPACING.sm },
  hostRow: { flexDirection: 'row', alignItems: 'center' },
  hostInfo: { flex: 1, marginLeft: SPACING.md },
  hostText: { fontSize: 15, color: COLORS.ink, fontWeight: '700' },
  hostSub: { fontSize: 12, color: COLORS.faint, marginTop: 2 },
  slotText: { ...TYPO.angka, color: COLORS.ink },
  progress: { height: 8, borderRadius: 4, backgroundColor: COLORS.line, marginTop: SPACING.sm, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: COLORS.brand600 },
  progressFillLow: { backgroundColor: COLORS.accent },
  desc: { fontSize: 14, color: COLORS.ink, lineHeight: 22 },
  detailLine: { fontSize: 14, color: COLORS.ink, marginTop: SPACING.sm, fontWeight: '600' },
  detailSub: { fontSize: 13, color: COLORS.faint, marginTop: 2 },
  partRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm },
  partName: { flex: 1, fontSize: 14, color: COLORS.ink, marginLeft: SPACING.sm, marginRight: SPACING.sm },
  sticky: {
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
    paddingHorizontal: SPACING.screen,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.screen,
    backgroundColor: COLORS.bg,
  },
  gap: { height: SPACING.sm },
});
