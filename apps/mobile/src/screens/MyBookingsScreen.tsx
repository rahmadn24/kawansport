import React from 'react';
import {
  ActivityIndicator,
  Button,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  BookingItem,
  bookingStatusLabel,
  formatIDR,
  formatSlotLabel,
} from '../api/bookings';

interface Props {
  bookings: BookingItem[];
  loading: boolean;
  error: string | null;
  /** Id booking yang sedang di-cancel (spinner per baris). */
  cancellingId: string | null;
  cancelError: string | null;
  onRefresh: () => void;
  onCancel: (booking: BookingItem) => void;
}

/** Layar My Bookings (BK-04): status + cancel (hanya pending). */
export function MyBookingsScreen({
  bookings,
  loading,
  error,
  cancellingId,
  cancelError,
  onRefresh,
  onCancel,
}: Props) {
  return (
    <View style={styles.box}>
      <Text style={styles.title}>Booking Saya</Text>
      {loading && bookings.length === 0 ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          style={styles.list}
          data={bookings}
          keyExtractor={(item) => item.id}
          onRefresh={onRefresh}
          refreshing={loading}
          ListEmptyComponent={<Text style={styles.empty}>Belum ada booking.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardRow}>
                <Text style={styles.cardTitle}>
                  {formatSlotLabel(item.date, item.start, item.end)}
                </Text>
                <Text style={statusStyle(item.status)}>{bookingStatusLabel(item.status)}</Text>
              </View>
              <Text style={styles.cardSub}>
                {formatIDR(item.amount)} • Order {item.paymentRef}
              </Text>
              {item.eventId ? (
                <Text style={styles.cardSub}>Event: {item.eventId}</Text>
              ) : null}
              {item.status === 'pending' ? (
                cancellingId === item.id ? (
                  <ActivityIndicator />
                ) : (
                  <Button title="Cancel" onPress={() => onCancel(item)} />
                )
              ) : null}
            </View>
          )}
        />
      )}
      {cancelError ? <Text style={styles.error}>{cancelError}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.gap} />
      <Button title="Refresh" onPress={onRefresh} />
    </View>
  );
}

function statusStyle(status: BookingItem['status']) {
  return status === 'paid'
    ? styles.paid
    : status === 'pending'
      ? styles.pending
      : status === 'cancelled'
        ? styles.cancelled
        : styles.expired;
}

const styles = StyleSheet.create({
  box: { flex: 1, padding: 24 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  list: { flex: 1 },
  empty: { textAlign: 'center', color: '#555', marginTop: 24 },
  card: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', flex: 1, marginRight: 8 },
  paid: { color: '#0a7d2c', fontWeight: '700' },
  pending: { color: '#b7791f', fontWeight: '700' },
  cancelled: { color: '#c00', fontWeight: '700' },
  expired: { color: '#888', fontWeight: '700' },
  cardSub: { fontSize: 13, color: '#555', marginTop: 4 },
  gap: { height: 12 },
  error: { color: '#c00', marginTop: 8, textAlign: 'center' },
});
