import React, { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
  UIProgressBar,
  UISectionTitle,
  UIStickyBar,
} from '../components/ui';
import {
  STITCH_COUNTDOWN_LABEL,
  STITCH_COUNTDOWN_PROGRESS,
  STITCH_PAY_METHODS,
  STITCH_PROTECTION,
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
 * Layar Checkout booking (BK-04, Stitch UX-03): countdown statis + venue
 * card + metode bayar radio + rincian + proteksi + sticky Total.
 *
 * - Timer countdown STATIS (TODO: hubungkan expiry backend).
 * - Nomor VA/referensi dari snap backend yg ada (paymentRef/snapToken).
 * - Rincian ST-04/API-W03 real dari snapshot server (subtotal, diskon
 *   voucher, poin, service fee); fee estimasi hanya fallback bila snapshot
 *   belum ada (booking lama). Kode check-in (API-W07) dari server.
 * - Nominal tombol bayar HARUS dari server (booking.amount).
 */
// TODO: hubungkan expiry backend untuk countdown.
// TODO(ST-08): rincian checkout kaya (VA per bank).
export function CheckoutScreen({ booking, courtLabel, onDone, onMyBookings }: Props) {
  const [method, setMethod] = useState(STITCH_PAY_METHODS[0]?.id ?? 'bca');
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

        {/* Banner urgency: countdown statis */}
        <View style={styles.urgency} accessibilityRole="text">
          <View style={styles.urgencyRow}>
            <Text style={styles.urgencyText}>⏱ Selesaikan pembayaran dalam</Text>
            <View style={styles.urgencyPill}>
              <Text style={styles.urgencyTime}>{STITCH_COUNTDOWN_LABEL}</Text>
            </View>
          </View>
          <UIProgressBar progress={STITCH_COUNTDOWN_PROGRESS} />
        </View>

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

        {/* Metode bayar */}
        <UISectionTitle>Metode Pembayaran</UISectionTitle>
        <UICard>
          <Text style={styles.payGroup}>Virtual Account Bank</Text>
          {STITCH_PAY_METHODS.filter((m) => m.id !== 'qris').map((m) => {
            const active = method === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                style={[styles.payRow, active && styles.payRowActive]}
                onPress={() => setMethod(m.id)}
                accessibilityRole="radio"
                accessibilityLabel={m.label}
                accessibilityState={{ selected: active }}
              >
                <View style={styles.payBadge}>
                  <Text style={styles.payBadgeText}>{m.badge}</Text>
                </View>
                <View style={styles.payInfo}>
                  <Text style={styles.payLabel}>{m.label}</Text>
                  <Text style={styles.paySub}>{m.sub}</Text>
                </View>
                <View style={[styles.radio, active && styles.radioActive]}>
                  {active ? <View style={styles.radioDot} /> : null}
                </View>
              </TouchableOpacity>
            );
          })}
          <Text style={styles.payGroup}>E-Wallet & QRIS Instant</Text>
          {STITCH_PAY_METHODS.filter((m) => m.id === 'qris').map((m) => {
            const active = method === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                style={[styles.payRow, active && styles.payRowActive]}
                onPress={() => setMethod(m.id)}
                accessibilityRole="radio"
                accessibilityLabel={m.label}
                accessibilityState={{ selected: active }}
              >
                <View style={styles.payBadge}>
                  <Text style={styles.payBadgeText}>{m.badge}</Text>
                </View>
                <View style={styles.payInfo}>
                  <Text style={styles.payLabel}>{m.label}</Text>
                  <Text style={styles.paySub}>{m.sub}</Text>
                </View>
                <View style={[styles.radio, active && styles.radioActive]}>
                  {active ? <View style={styles.radioDot} /> : null}
                </View>
              </TouchableOpacity>
            );
          })}
          {/* Nomor referensi dari backend (bukan nomor VA palsu). */}
          <View style={styles.vaBox}>
            <View style={styles.vaInfo}>
              <Text style={styles.vaLabel}>Referensi pembayaran:</Text>
              <Text style={styles.vaValue} selectable>
                {booking.paymentRef}
              </Text>
              {booking.snapToken ? (
                <Text style={styles.vaSub} numberOfLines={1}>
                  Kode pembayaran: {booking.snapToken}
                </Text>
              ) : null}
            </View>
          </View>
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
              <Text style={styles.totalSub}>Nominal dari server</Text>
            </View>
            <Text style={styles.totalValue}>{formatIDR(total)}</Text>
          </View>
        </UICard>

        {/* Proteksi */}
        <View style={styles.protect}>
          <View style={styles.protectIcon} accessibilityElementsHidden>
            <Text style={styles.protectIconText}>🛡</Text>
          </View>
          <View style={styles.protectBody}>
            <Text style={styles.protectTitle}>{STITCH_PROTECTION.title}</Text>
            <Text style={styles.protectMsg}>{STITCH_PROTECTION.message}</Text>
          </View>
        </View>

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
  urgency: {
    backgroundColor: COLORS.accentSoft,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  urgencyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  urgencyText: { fontSize: 13, fontWeight: '700', color: COLORS.pendingFg },
  urgencyPill: { backgroundColor: COLORS.bg, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4 },
  urgencyTime: { fontSize: 14, fontWeight: '800', color: COLORS.accent },
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
  payGroup: { fontSize: 12, fontWeight: '700', color: COLORS.muted, marginTop: SPACING.md, marginBottom: SPACING.sm },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.bg,
  },
  payRowActive: { borderColor: COLORS.brand700, backgroundColor: COLORS.bgAlt },
  payBadge: {
    minWidth: 44,
    height: 28,
    borderRadius: 6,
    backgroundColor: COLORS.bgAlt,
    borderWidth: 1,
    borderColor: COLORS.line,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginRight: SPACING.md,
  },
  payBadgeText: { fontSize: 11, fontWeight: '800', color: COLORS.ink },
  payInfo: { flex: 1 },
  payLabel: { fontSize: 14, fontWeight: '700', color: COLORS.ink },
  paySub: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: COLORS.brand700 },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.brand700 },
  vaBox: {
    backgroundColor: COLORS.bgAlt,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  vaInfo: {},
  vaLabel: { fontSize: 12, color: COLORS.muted },
  vaValue: { fontSize: 15, fontWeight: '800', color: COLORS.ink, marginTop: 2 },
  vaSub: { fontSize: 12, color: COLORS.faint, marginTop: 4 },
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
  protect: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgAlt,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.md,
  },
  protectIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.brand700,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  protectIconText: { fontSize: 18 },
  protectBody: { flex: 1 },
  protectTitle: { fontSize: 14, fontWeight: '700', color: COLORS.ink },
  protectMsg: { fontSize: 13, color: COLORS.muted, marginTop: 4, lineHeight: 20 },
  gap: { height: SPACING.md },
});
