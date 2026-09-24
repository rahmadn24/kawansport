import React from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  BookingItem,
  bookingStatusLabel,
  formatIDR,
  formatSlotLabel,
} from '../api/bookings';
import { COLORS, RADIUS, SPACING, TYPO } from '../theme';
import {
  UIBadge,
  UIButton,
  UICard,
  UISectionTitle,
  UIStickyBar,
} from '../components/ui';
import {
  UICountdownBanner,
  UIPayRef,
  UIProtectionBanner,
  UISnapMethods,
} from '../components/payment';
import {
  STITCH_SERVICE_FEE,
  bookingBadgeKind,
} from '../mocks/stitch';

interface Props {
  booking: BookingItem;
  /** Venue/court label bila diketahui (opsional, dari flow). */
  courtLabel: string | null;
  onDone: () => void;
  onMyBookings: () => void;
}

/**
 * Layar Checkout booking (BK-04, Stitch UX-03): countdown live + venue
 * card + info metode Snap + rincian + proteksi + sticky Total.
 *
 * - Countdown LIVE dari createdAt + TTL server 30 mnt (ST-08,
 *   `src/api/payment.ts`); kedaluwarsa -> ajakan refresh (status server).
 * - Nomor referensi dari snap backend yg ada (paymentRef/snapToken) +
 *   tombol Salin (fallback salin manual — lib Clipboard belum dipasang).
 * - Rincian ST-04/API-W03 real dari snapshot server (subtotal, diskon
 *   voucher, poin, service fee); fee estimasi hanya fallback bila snapshot
 *   belum ada (booking lama). Kode check-in (API-W07) dari server.
 * - Nominal tombol bayar HARUS dari server (booking.amount).
 * - Metode bayar: info statis yg didukung Snap, dipilih di halaman Midtrans
 *   (flow redirect) — JANGAN klaim pilih-di-app.
 */
export function CheckoutScreen({ booking, courtLabel, onDone, onMyBookings }: Props) {
  const isStub = (booking.snapToken ?? '').startsWith('stub-snap-');
  // Total tagihan dari server — JANGAN diganti nominal mock.
  const total = booking.amount;

  const handlePay = () => {
    if (booking.redirectUrl) {
      Linking.openURL(booking.redirectUrl).catch(() =>
        Alert.alert(
          'Gagal membuka pembayaran',
          'Tidak bisa membuka link pembayaran. Coba lagi dari Booking Saya.',
        ),
      );
      return;
    }
    onMyBookings();
  };

  return (
    <View style={styles.box}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollPad}>
        <Text style={styles.title}>Checkout Booking</Text>

        {/* Banner urgency: countdown live dari createdAt + TTL server 30 mnt */}
        <UICountdownBanner createdAt={booking.createdAt} onExpiredAction={onMyBookings} />

        {/* Venue card */}
        <UICard>
          <View style={styles.venueRow}>
            <View style={styles.venueThumb} accessibilityElementsHidden>
              <Text style={styles.venueThumbText}>🏟</Text>
            </View>
            <View style={styles.venueHead}>
              <UIBadge kind={bookingBadgeKind(booking.status)} label={bookingStatusLabel(booking.status)} />
              <Text style={styles.venueName} numberOfLines={2}>
                {courtLabel ?? 'Booking lapangan'}
              </Text>
              <Text style={styles.venueSub}>
                {formatSlotLabel(booking.date, booking.start, booking.end)}
              </Text>
            </View>
          </View>
          <View style={styles.sessionBox}>
            <Text style={styles.sessionText}>
              {booking.start}–{booking.end} WIB
            </Text>
            <Text style={styles.sessionDur}>Order {booking.paymentRef}</Text>
          </View>
        </UICard>

        {/* Metode bayar: info statis yg didukung Snap, dipilih di halaman Midtrans */}
        <UISectionTitle>Metode Pembayaran</UISectionTitle>
        <UICard>
          <UISnapMethods />
          {/* Nomor referensi dari backend (bukan nomor VA palsu) + tombol Salin. */}
          <UIPayRef label="Referensi pembayaran" value={booking.paymentRef} />
          {booking.snapToken ? (
            <UIPayRef label="Kode pembayaran" value={booking.snapToken} />
          ) : null}
          {isStub ? (
            <Text style={styles.stub}>
              Pembayaranmu dicatat. Status lunas muncul otomatis setelah server mengonfirmasi — pantau di Booking Saya.
            </Text>
          ) : null}
        </UICard>

        {/* Rincian: snapshot server (ST-04/API-W03), fallback estimasi utk booking lama */}
        <UISectionTitle>Rincian Pembayaran</UISectionTitle>
        <UICard>
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Sewa lapangan</Text>
            <Text style={styles.feeValue}>{formatIDR(booking.subtotal ?? booking.amount)}</Text>
          </View>
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Biaya layanan komunitas</Text>
            <Text style={styles.feeValue}>
              {formatIDR(booking.serviceFee ?? STITCH_SERVICE_FEE)}
            </Text>
          </View>
          {booking.serviceFee == null ? (
            <Text style={styles.feeNote}>
              Biaya layanan estimasi (booking lama, tanpa snapshot server).
            </Text>
          ) : null}
          {(booking.discount ?? 0) > 0 ? (
            <View style={styles.feeRow}>
              <Text style={styles.feeLabel}>
                Diskon voucher{booking.voucherCode ? ` (${booking.voucherCode})` : ''}
              </Text>
              <Text style={[styles.feeValue, styles.discountValue]}>
                −{formatIDR(booking.discount ?? 0)}
              </Text>
            </View>
          ) : null}
          {(booking.pointsUsed ?? 0) > 0 ? (
            <View style={styles.feeRow}>
              <Text style={styles.feeLabel}>Poin Kawan dipakai</Text>
              <Text style={[styles.feeValue, styles.discountValue]}>
                −{formatIDR(booking.pointsUsed ?? 0)}
              </Text>
            </View>
          ) : null}
          {booking.code ? (
            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>Kode check-in di venue:</Text>
              <Text style={styles.codeValue} selectable>
                {booking.code}
              </Text>
            </View>
          ) : null}
          <View style={styles.divider} />
          <View style={styles.feeRow}>
            <View>
              <Text style={styles.totalLabel}>Total Tagihan</Text>
              <Text style={styles.totalSub}>Sudah termasuk pajak & biaya layanan</Text>
            </View>
            <Text style={styles.totalValue}>{formatIDR(total)}</Text>
          </View>
        </UICard>

        {/* Proteksi: redaksi jujur ST-08 (tanpa klaim escrow) */}
        <UIProtectionBanner />

        <View style={styles.gap} />
        <UIButton title="Lihat Booking Saya" variant="outline" onPress={onMyBookings} />
        <View style={styles.gap} />
        <UIButton title="Kembali" variant="ghost" onPress={onDone} />
      </ScrollView>

      {/* Sticky: total server + Bayar Sekarang oranye */}
      <UIStickyBar
        totalLabel="Total Bayar"
        totalValue={formatIDR(total)}
        ctaTitle="Bayar Sekarang"
        onCta={handlePay}
        ctaA11y={`Bayar sekarang, total ${formatIDR(total)}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1 },
  scrollPad: { paddingHorizontal: SPACING.screen, paddingTop: SPACING.screen, paddingBottom: SPACING.screen },
  title: { ...TYPO.title, color: COLORS.ink, marginBottom: SPACING.md, textAlign: 'center' },
  venueRow: { flexDirection: 'row', alignItems: 'center' },
  venueThumb: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bgAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  venueThumbText: { fontSize: 28 },
  venueHead: { flex: 1 },
  venueName: { ...TYPO.cardTitle, color: COLORS.ink, marginTop: SPACING.xs },
  venueSub: { fontSize: 13, color: COLORS.muted, marginTop: 2 },
  sessionBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.bgAlt,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    marginTop: SPACING.md,
  },
  sessionText: { fontSize: 13, fontWeight: '700', color: COLORS.ink },
  sessionDur: { fontSize: 12, color: COLORS.muted },
  stub: { fontSize: 13, color: COLORS.pendingFg, marginTop: SPACING.md },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.sm },
  feeLabel: { fontSize: 14, color: COLORS.muted },
  feeValue: { fontSize: 14, fontWeight: '600', color: COLORS.ink },
  discountValue: { color: COLORS.brand700 },
  feeNote: { fontSize: 12, color: COLORS.faint, marginTop: SPACING.xs },
  codeBox: {
    backgroundColor: COLORS.bgAlt,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  codeLabel: { fontSize: 12, color: COLORS.muted },
  codeValue: { fontSize: 18, fontWeight: '800', color: COLORS.ink, marginTop: 2, letterSpacing: 1 },
  divider: { height: 1, backgroundColor: COLORS.line, marginVertical: SPACING.md },
  totalLabel: { fontSize: 15, fontWeight: '700', color: COLORS.ink },
  totalSub: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  totalValue: { ...TYPO.angka, color: COLORS.ink },
  gap: { height: SPACING.md },
});
