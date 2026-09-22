import React from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import {
  BookingItem,
  bookingStatusLabel,
  formatIDR,
  formatSlotLabel,
} from '../api/bookings';

interface Props {
  booking: BookingItem;
  /** Venue/court label bila diketahui (opsional, dari flow). */
  courtLabel: string | null;
  onDone: () => void;
  onMyBookings: () => void;
}

/**
 * Layar Checkout (BK-04): ringkasan booking pending + info bayar Snap.
 * Tanpa server key, server mengembalikan stub (`stub-snap-*` + redirect_url
 * stub) — tampilkan apa adanya agar alur tetap bisa diuji end-to-end.
 */
export function CheckoutScreen({ booking, courtLabel, onDone, onMyBookings }: Props) {
  const isStub = (booking.snapToken ?? '').startsWith('stub-snap-');
  return (
    <View style={styles.box}>
      <Text style={styles.title}>Checkout</Text>
      <View style={styles.card}>
        <Text style={styles.row}>Status: {bookingStatusLabel(booking.status)}</Text>
        {courtLabel ? <Text style={styles.row}>{courtLabel}</Text> : null}
        <Text style={styles.row}>
          {formatSlotLabel(booking.date, booking.start, booking.end)}
        </Text>
        <Text style={styles.amount}>{formatIDR(booking.amount)}</Text>
        <Text style={styles.sub}>Order: {booking.paymentRef}</Text>
        {booking.redirectUrl ? (
          <Text style={styles.sub}>Bayar: {booking.redirectUrl}</Text>
        ) : null}
        {booking.snapToken ? (
          <Text style={styles.sub}>Snap token: {booking.snapToken}</Text>
        ) : null}
        {isStub ? (
          <Text style={styles.stub}>
            Mode stub (tanpa Midtrans server key): selesaikan pembayaran via webhook
            settlement di server untuk menandai lunas.
          </Text>
        ) : null}
      </View>
      <View style={styles.gap} />
      <Button title="Lihat Booking Saya" onPress={onMyBookings} />
      <View style={styles.gap} />
      <Button title="Kembali" onPress={onDone} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, padding: 24, justifyContent: 'flex-start' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  card: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 16 },
  row: { fontSize: 14, color: '#222', marginTop: 6 },
  amount: { fontSize: 20, fontWeight: '700', marginTop: 12 },
  sub: { fontSize: 13, color: '#555', marginTop: 6 },
  stub: { fontSize: 13, color: '#b7791f', marginTop: 12 },
  gap: { height: 12 },
});
