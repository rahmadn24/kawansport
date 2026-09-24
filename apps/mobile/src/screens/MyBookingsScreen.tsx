import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  BookingItem,
  BookingStatus,
  bookingStatusLabel,
  formatIDR,
  formatSlotLabel,
} from '../api/bookings';
import { COLORS, RADIUS, SPACING, TYPO } from '../theme';
import {
  UIBadge,
  UIEmptyState,
  UIErrorBanner,
  UIHeader,
  UISegmented,
} from '../components/ui';
import { bookingBadgeKind } from '../mocks/stitch';
import { BOOKING_PAYMENT_TTL_MS } from '../api/payment';
import { payRemainingLabel, useNowTick } from '../components/payment';

interface Props {
  bookings: BookingItem[];
  loading: boolean;
  error: string | null;
  /** Id booking yang sedang di-cancel (spinner per baris). */
  cancellingId: string | null;
  cancelError: string | null;
  onRefresh: () => void;
  onCancel: (booking: BookingItem) => void;
  /** Nama venue per courtId (real, dari daftar venue yg dimuat flow). */
  venueNameByCourt?: Record<string, string>;
  /** Bayar ulang booking pending via alur existing (opsional). */
  onRepay?: (booking: BookingItem) => void;
  /** GAP-01: bell -> kotak masuk notifikasi (ganti Alert GAP-01). */
  onBellPress?: () => void;
}

type StatusFilter = BookingStatus | null;

/**
 * Layar My Bookings (BK-04, Stitch UX-03): badge status berwarna + nama
 * venue (bukan ID) + filter segmented + bayar ulang pending.
 */
// TODO(ST-08): nama venue/event dari API booking kaya (saat ini dipetakan dari daftar venue).
export function MyBookingsScreen({
  bookings,
  loading,
  error,
  cancellingId,
  cancelError,
  onRefresh,
  onCancel,
  venueNameByCourt,
  onRepay,
  onBellPress,
}: Props) {
  const [filter, setFilter] = useState<StatusFilter>(null);
  const shown = filter ? bookings.filter((b) => b.status === filter) : bookings;
  // Tick 30 dtk agar label sisa waktu pending (ST-08) tetap segar.
  const nowMs = useNowTick(30000);

  const venueNameOf = (b: BookingItem): string | null => {
    const fromMap = venueNameByCourt?.[b.courtId];
    if (fromMap) return fromMap;
    return null;
  };

  const handleRepay = (b: BookingItem) => {
    if (onRepay) {
      onRepay(b);
      return;
    }
    if (b.redirectUrl) {
      Linking.openURL(b.redirectUrl).catch(() =>
        Alert.alert(
          'Gagal membuka pembayaran',
          `Tidak bisa membuka link bayar booking ${b.paymentRef}. Coba lagi.`,
        ),
      );
    }
  };

  return (
    <View style={styles.screen}>
      <UIHeader locationText="Sekitarmu" onBellPress={onBellPress} />
      <View style={styles.content}>
        <Text style={styles.title}>Booking Saya</Text>

        <UISegmented<BookingStatus>
          label="Saring status booking"
          options={[
            { value: null, label: 'Semua' },
            { value: 'pending', label: 'Menunggu' },
            { value: 'paid', label: 'Lunas' },
            { value: 'expired', label: 'Kedaluwarsa' },
            { value: 'cancelled', label: 'Batal' },
          ]}
          value={filter}
          onChange={setFilter}
        />

        {loading && bookings.length === 0 ? (
          <ActivityIndicator accessibilityLabel="Memuat booking" />
        ) : (
          <FlatList
            style={styles.list}
            contentContainerStyle={styles.listPad}
            data={shown}
            keyExtractor={(item) => item.id}
            onRefresh={onRefresh}
            refreshing={loading}
            ListEmptyComponent={
              <UIEmptyState
                illustration="🎫"
                title="Belum ada booking"
                message={
                  filter
                    ? 'Tidak ada booking dengan status ini.'
                    : 'Booking lapanganmu akan muncul di sini.'
                }
              />
            }
            renderItem={({ item }) => {
              const venueName = venueNameOf(item);
              return (
                <View style={styles.card}>
                  <View style={styles.cardRow}>
                    <View style={styles.cardHead}>
                      <Text style={styles.cardTitle} numberOfLines={2}>
                        {venueName ?? (item.eventId ? 'Booking event' : 'Booking lapangan')}
                      </Text>
                      <Text style={styles.cardSub}>
                        {formatSlotLabel(item.date, item.start, item.end)}
                      </Text>
                      <Text style={styles.cardSub} selectable>
                        {formatIDR(item.amount)} • Order {item.paymentRef}
                      </Text>
                      {/* ST-08: sisa waktu dari createdAt + TTL server 30 mnt;
                          habis -> ajakan refresh (status server). */}
                      {item.status === 'pending' ? (
                        <Text style={styles.countdown}>
                          {payRemainingLabel(item.createdAt, BOOKING_PAYMENT_TTL_MS, nowMs)}
                        </Text>
                      ) : null}
                      {item.code ? (
                        <Text style={styles.cardSub}>Kode check-in: {item.code}</Text>
                      ) : null}
                    </View>
                    <UIBadge kind={bookingBadgeKind(item.status)} label={bookingStatusLabel(item.status)} />
                  </View>
                  {item.status === 'pending' ? (
                    <View style={styles.actions}>
                      {cancellingId === item.id ? (
                        <ActivityIndicator />
                      ) : (
                        <>
                          <TouchableOpacity
                            style={styles.payBtn}
                            onPress={() => handleRepay(item)}
                            accessibilityRole="button"
                            accessibilityLabel={`Bayar ulang booking ${item.paymentRef}, total ${formatIDR(item.amount)}`}
                          >
                            <Text style={styles.payBtnText}>Bayar Ulang</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.cancelBtn}
                            onPress={() => onCancel(item)}
                            accessibilityRole="button"
                            accessibilityLabel={`Batalkan booking ${item.paymentRef}`}
                          >
                            <Text style={styles.cancelBtnText}>Batalkan</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  ) : null}
                </View>
              );
            }}
          />
        )}
        {cancelError ? <Text style={styles.error}>{cancelError}</Text> : null}
        <UIErrorBanner message={error} actionLabel="Coba lagi" onAction={onRefresh} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  content: { flex: 1, paddingHorizontal: SPACING.screen },
  title: { ...TYPO.title, color: COLORS.ink, marginBottom: SPACING.md, textAlign: 'center' },
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
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardHead: { flex: 1, marginRight: SPACING.sm },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.ink },
  cardSub: { fontSize: 13, color: COLORS.muted, marginTop: 4 },
  countdown: { fontSize: 12, color: COLORS.pendingFg, fontWeight: '700', marginTop: 4 },
  actions: { flexDirection: 'row', marginTop: SPACING.md },
  payBtn: {
    flex: 1,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.full,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  payBtnText: { color: COLORS.bg, fontSize: 14, fontWeight: '700' },
  cancelBtn: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderWidth: 1.5,
    borderColor: COLORS.danger,
    borderRadius: RADIUS.full,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: { color: COLORS.danger, fontSize: 14, fontWeight: '700' },
  error: { color: COLORS.danger, marginTop: SPACING.sm, textAlign: 'center' },
});
