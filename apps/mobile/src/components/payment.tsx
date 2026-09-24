/**
 * Komponen pembayaran bersama ST-08: countdown jujur, salin ref,
 * banner proteksi jujur, info metode Snap statis. UI only.
 */
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS, RADIUS, SPACING } from '../theme';
import { UIProgressBar } from './ui';
import {
  BOOKING_PAYMENT_TTL_MS,
  PAYMENT_PROTECTION,
  SNAP_METHODS_NOTE,
  SNAP_PAY_METHODS_INFO,
  formatCountdown,
  isPaymentExpired,
  paymentProgress,
  paymentRemainingMs,
  tryCopyText,
} from '../api/payment';

/** Jam "sekarang" yg menick tiap intervalMs (default 1 dtk). */
export function useNowTick(intervalMs: number = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** Banner countdown jujur: createdAt + TTL server; habis -> ajakan refresh. */
export function UICountdownBanner({
  createdAt,
  ttlMs = BOOKING_PAYMENT_TTL_MS,
  onExpiredAction,
  expiredActionLabel = 'Muat ulang status',
}: {
  createdAt: string;
  ttlMs?: number;
  onExpiredAction?: () => void;
  expiredActionLabel?: string;
}) {
  const now = useNowTick(1000);
  const expired = isPaymentExpired(createdAt, ttlMs, now);
  const remaining = paymentRemainingMs(createdAt, ttlMs, now);
  const progress = paymentProgress(createdAt, ttlMs, now);

  if (expired) {
    return (
      <View style={styles.urgency} accessibilityRole="alert">
        <Text style={styles.urgencyText}>⏱ Waktu pembayaran habis</Text>
        <Text style={styles.expiredSub}>
          Batas bayar 30 menit sejak dibuat (aturan server). Tarik untuk memuat ulang —
          status Kedaluwarsa diperbarui dari server.
        </Text>
        {onExpiredAction ? (
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={onExpiredAction}
            accessibilityRole="button"
            accessibilityLabel={expiredActionLabel}
          >
            <Text style={styles.refreshText}>{expiredActionLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.urgency} accessibilityRole="text">
      <View style={styles.urgencyRow}>
        <Text style={styles.urgencyText}>⏱ Selesaikan pembayaran dalam</Text>
        <View style={styles.urgencyPill}>
          <Text style={styles.urgencyTime}>{formatCountdown(remaining)}</Text>
        </View>
      </View>
      <UIProgressBar progress={progress} />
      <Text style={styles.ttlNote}>
        Batas bayar 30 menit sejak dibuat (aturan server).
      </Text>
    </View>
  );
}

/** Baris referensi bayar: teks selectable + tombol Salin (fallback manual). */
export function UIPayRef({ label, value }: { label: string; value: string }) {
  const handleCopy = () => {
    if (tryCopyText(value)) {
      Alert.alert('Disalin', 'Referensi pembayaran disalin ke clipboard.');
    } else {
      // TODO(ST-08): pasang @react-native-clipboard/clipboard; sementara salin manual.
      Alert.alert(
        'Salin manual',
        'Tekan lama teks referensi untuk menyalin (lib Clipboard belum dipasang).',
      );
    }
  };
  return (
    <View style={styles.vaBox}>
      <View style={styles.vaInfo}>
        <Text style={styles.vaLabel}>{label}:</Text>
        <Text style={styles.vaValue} selectable>
          {value}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.copyBtn}
        onPress={handleCopy}
        accessibilityRole="button"
        accessibilityLabel={`Salin ${label} ${value}`}
      >
        <Text style={styles.copyText}>Salin</Text>
      </TouchableOpacity>
    </View>
  );
}

/** Banner proteksi jujur — tanpa klaim escrow. */
export function UIProtectionBanner() {
  return (
    <View style={styles.protect}>
      <View style={styles.protectIcon} accessibilityElementsHidden>
        <Text style={styles.protectIconText}>🛡</Text>
      </View>
      <View style={styles.protectBody}>
        <Text style={styles.protectTitle}>{PAYMENT_PROTECTION.title}</Text>
        <Text style={styles.protectMsg}>{PAYMENT_PROTECTION.message}</Text>
      </View>
    </View>
  );
}

/** Daftar metode Snap statis: dipilih di halaman Midtrans, bukan di app. */
export function UISnapMethods() {
  return (
    <View>
      {SNAP_PAY_METHODS_INFO.map((m) => (
        <View key={m.id} style={styles.payRow} accessibilityRole="text">
          <View style={styles.payBadge}>
            <Text style={styles.payBadgeText}>{m.badge}</Text>
          </View>
          <View style={styles.payInfo}>
            <Text style={styles.payLabel}>{m.label}</Text>
          </View>
        </View>
      ))}
      <Text style={styles.methodsNote}>{SNAP_METHODS_NOTE}</Text>
    </View>
  );
}

/** Sisa waktu ringkas untuk baris pending di list (dihitung saat render). */
export function payRemainingLabel(createdAt: string, ttlMs: number, nowMs?: number): string {
  if (isPaymentExpired(createdAt, ttlMs, nowMs)) {
    return 'Waktu bayar habis — tarik untuk memuat ulang.';
  }
  return `Sisa waktu bayar ${formatCountdown(paymentRemainingMs(createdAt, ttlMs, nowMs))} (batas 30 mnt server).`;
}

const styles = StyleSheet.create({
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
  ttlNote: { fontSize: 12, color: COLORS.muted, marginTop: SPACING.sm },
  expiredSub: { fontSize: 13, color: COLORS.pendingFg, marginTop: SPACING.sm, lineHeight: 20 },
  refreshBtn: {
    marginTop: SPACING.md,
    minHeight: 44,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.brand700,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshText: { fontSize: 14, fontWeight: '700', color: COLORS.brand700 },
  vaBox: {
    backgroundColor: COLORS.bgAlt,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  vaInfo: { flex: 1 },
  vaLabel: { fontSize: 12, color: COLORS.muted },
  vaValue: { fontSize: 15, fontWeight: '800', color: COLORS.ink, marginTop: 2 },
  copyBtn: {
    minWidth: 72,
    minHeight: 44,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.brand700,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
    marginLeft: SPACING.sm,
  },
  copyText: { fontSize: 14, fontWeight: '700', color: COLORS.brand700 },
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
  methodsNote: { fontSize: 12, color: COLORS.muted, marginTop: SPACING.xs, lineHeight: 18 },
});
