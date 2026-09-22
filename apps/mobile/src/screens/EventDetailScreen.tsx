import React from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, View } from 'react-native';
import { EventDetail, EventParticipantItem, slotsLeft } from '../api/events';
import { bookingStatusLabel, formatSlotLabel } from '../api/bookings';

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
 * Layar Event Detail (SM-04 + SM-05): info lengkap + host + status slot,
 * tombol Join/Leave, daftar peserta, badge FULL (join disabled saat penuh).
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
  return (
    <View style={styles.box}>
      <Text style={styles.title}>Detail Event</Text>
      {loading && !event ? (
        <ActivityIndicator />
      ) : event ? (
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.eventTitle}>{event.title}</Text>
            <Text style={event.status === 'open' ? styles.open : styles.full}>
              {event.status === 'open' ? 'OPEN' : 'FULL'}
            </Text>
          </View>
          <Text style={styles.sub}>
            {event.sport} • {new Date(event.datetime).toLocaleString()}
          </Text>
          {event.description ? <Text style={styles.desc}>{event.description}</Text> : null}
          <Text style={styles.sub}>
            Lokasi: {event.lat}, {event.lng}
          </Text>
          <Text style={styles.sub}>
            Peserta: {event.participantsCount}/{event.capacity} (tersisa{' '}
            {slotsLeft(event)})
          </Text>
          <Text style={styles.sub}>
            Host: {event.host.displayName ?? event.host.email}
          </Text>
          <View style={styles.gap} />
          {mutating ? (
            <ActivityIndicator />
          ) : event.isJoined ? (
            <Button title="Leave" onPress={onLeave} />
          ) : (
            <Button title={isFull ? 'FULL — Slot Habis' : 'Join'} onPress={onJoin} disabled={isFull} />
          )}
          {joinError ? <Text style={styles.error}>{joinError}</Text> : null}
          <View style={styles.gap} />
          <Button title="Book Court" onPress={onBookCourt} />
          {event.booking ? (
            <Text style={styles.sub}>
              Booking: {formatSlotLabel(event.booking.date, event.booking.start, event.booking.end)}{' '}
              • {bookingStatusLabel(event.booking.status)}
            </Text>
          ) : null}
          <View style={styles.gap} />
          <Text style={styles.sectionTitle}>
            Peserta ({participants.length}/{event.capacity})
          </Text>
          {participantsLoading && participants.length === 0 ? (
            <ActivityIndicator />
          ) : participants.length === 0 ? (
            <Text style={styles.sub}>Belum ada peserta.</Text>
          ) : (
            participants.map((p) => (
              <Text key={p.userId} style={styles.sub}>
                • {p.displayName ?? p.email}
                {p.userId === event.host.id ? ' (host)' : ''}
              </Text>
            ))
          )}
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.gap} />
      <Button title="Refresh" onPress={onRefresh} />
      <View style={styles.gap} />
      <Button title="Kembali" onPress={onBack} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, padding: 24, justifyContent: 'flex-start' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  card: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eventTitle: { fontSize: 18, fontWeight: '700', flex: 1, marginRight: 8 },
  open: { color: '#0a7d2c', fontWeight: '700' },
  full: { color: '#c00', fontWeight: '700' },
  sub: { fontSize: 14, color: '#444', marginTop: 8 },
  desc: { fontSize: 14, color: '#222', marginTop: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginTop: 4 },
  gap: { height: 12 },
  error: { color: '#c00', marginTop: 8, textAlign: 'center' },
});
