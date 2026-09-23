import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { EventDetail, EventParticipantItem, slotsLeft } from '../api/events';
import { bookingStatusLabel, formatSlotLabel } from '../api/bookings';
import { COLORS, SPACING, TYPO, formatWIB, friendlyServerError } from '../theme';
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

/**
 * Layar Event Detail (SM-04 + SM-05): header + peserta + detail +
 * daftar peserta, sticky Join/Leave/Book Court.
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
            <UICard>
              <View style={styles.row}>
                <Text style={styles.eventTitle} accessibilityRole="header">
                  {event.title}
                </Text>
                <UIBadge
                  kind={event.status === 'open' ? 'open' : 'full'}
                  label={event.status === 'open' ? 'OPEN' : 'FULL'}
                  icon={event.status === 'open' ? '●' : '■'}
                />
              </View>
              <Text style={styles.meta}>
                {event.sport} • {formatWIB(event.datetime)}
              </Text>
              <View style={styles.hostRow}>
                <UIAvatar
                  name={event.host.displayName}
                  email={event.host.email}
                  uri={event.host.avatarUrl}
                  size={36}
                />
                <Text style={styles.hostText}>
                  Host: {event.host.displayName ?? event.host.email}
                </Text>
              </View>
            </UICard>

            <UISectionTitle>Peserta</UISectionTitle>
            <UICard>
              <Text style={styles.slotText} accessibilityLabel={`Sisa ${slotsLeft(event)} dari ${event.capacity} slot`}>
                Sisa {slotsLeft(event)} dari {event.capacity} slot
              </Text>
              <View style={styles.progress} accessibilityElementsHidden>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.min(100, Math.round((event.participantsCount / Math.max(1, event.capacity)) * 100))}%` },
                  ]}
                />
              </View>
              <Text style={styles.meta}>
                {event.participantsCount}/{event.capacity} sudah gabung
              </Text>
            </UICard>

            <UISectionTitle>Detail</UISectionTitle>
            <UICard>
              {event.description ? <Text style={styles.desc}>{event.description}</Text> : null}
              <Text style={styles.detailLine}>📍 Titik lokasi event sudah ditandai</Text>
              <Text style={styles.detailSub}>Rincian alamat menyusul dari host</Text>
              {event.booking ? (
                <Text style={styles.detailLine}>
                  🏟 Lapangan: {formatSlotLabel(event.booking.date, event.booking.start, event.booking.end)} •{' '}
                  {bookingStatusLabel(event.booking.status)}
                </Text>
              ) : null}
            </UICard>

            <UISectionTitle>Yang ikut ({participants.length}/{event.capacity})</UISectionTitle>
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
            ) : (
              <UIButton
                title={isFull ? 'Penuh — Slot Habis' : 'Ikut Event'}
                variant="primary"
                onPress={onJoin}
                disabled={isFull}
                loading={mutating}
                loadingTitle="Memproses…"
                accessibilityLabel={isFull ? 'Event penuh, slot habis' : 'Ikut event ini'}
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
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  eventTitle: { fontSize: 18, fontWeight: '800', color: COLORS.ink, flex: 1, marginRight: SPACING.sm },
  meta: { fontSize: 13, color: COLORS.muted, marginTop: SPACING.sm },
  hostRow: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.md },
  hostText: { fontSize: 14, color: COLORS.ink, fontWeight: '600', marginLeft: SPACING.sm, flex: 1 },
  slotText: { ...TYPO.angka, color: COLORS.ink },
  progress: { height: 8, borderRadius: 4, backgroundColor: COLORS.line, marginTop: SPACING.sm, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: COLORS.brand600 },
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
