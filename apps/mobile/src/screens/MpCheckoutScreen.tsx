import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatIDR } from '../api/bookings';
import { ShopOrder, shopOrderStatusLabel } from '../api/shop';
import { COLORS, RADIUS, SPACING, TYPO } from '../theme';
import {
  UIBadge,
  UIButton,
  UICard,
  UISectionTitle,
  UIStickyBar,
} from '../components/ui';
import { STITCH_PROTECTION, orderBadgeKind } from '../mocks/stitch';

interface Props {
  order: ShopOrder;
  onDone: () => void;
  onMyOrders: () => void;
}

/**
 * Layar Checkout marketplace (MP-02, Stitch UX-03): ringkasan 1 order +
 * N grup seller + rincian real + proteksi + sticky Total.
 * Nominal di sticky HARUS dari server (order.total).
 */
export function MpCheckoutScreen({ order, onDone, onMyOrders }: Props) {
  const isStub = (order.snapToken ?? '').startsWith('stub-snap-');
  const itemCount = order.groups.reduce((sum, g) => sum + g.items.length, 0);
  return (
    <View style={styles.box}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollPad}>
        <Text style={styles.title}>Checkout Berhasil</Text>

        <UICard>
          <View style={styles.headRow}>
            <View style={styles.headInfo}>
              <UIBadge kind={orderBadgeKind(order.status)} label={shopOrderStatusLabel(order.status)} />
              <Text style={styles.amount}>{formatIDR(order.total)}</Text>
              <Text style={styles.sub}>Order: {order.paymentRef}</Text>
            </View>
          </View>
          {order.groups.map((g) => (
            <View key={g.id} style={styles.group}>
              <View style={styles.groupHead}>
                <Text style={styles.groupTitle} numberOfLines={1}>
                  {g.sellerShopName || 'Toko'}
                </Text>
                <UIBadge kind={orderBadgeKind(g.status)} label={shopOrderStatusLabel(g.status)} />
              </View>
              {g.items.map((it) => (
                <View key={it.productId} style={styles.itemRow}>
                  <Text style={styles.itemName} numberOfLines={2}>
                    {it.productName} × {it.qty}
                  </Text>
                  <Text style={styles.itemSub}>{formatIDR(it.subtotal)}</Text>
                </View>
              ))}
              <Text style={styles.groupSubtotal}>Subtotal: {formatIDR(g.subtotal)}</Text>
            </View>
          ))}
          {order.snapToken ? (
            <Text style={styles.sub} numberOfLines={1}>
              Kode pembayaran: {order.snapToken}
            </Text>
          ) : null}
          {isStub ? (
            <Text style={styles.stub}>
              Pesananmu dicatat. Status lunas muncul otomatis setelah server mengonfirmasi — pantau di Order Saya.
            </Text>
          ) : null}
        </UICard>

        <UISectionTitle>Rincian Pembayaran</UISectionTitle>
        <UICard>
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Total order ({itemCount} item)</Text>
            <Text style={styles.feeValue}>{formatIDR(order.total)}</Text>
          </View>
          <Text style={styles.feeNote}>Nominal dari server.</Text>
        </UICard>

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
        <UIButton title="Kembali ke Keranjang" variant="ghost" onPress={onDone} />
      </ScrollView>

      <UIStickyBar
        totalLabel="Total Bayar"
        totalValue={formatIDR(order.total)}
        ctaTitle="Lihat Order Saya"
        onCta={onMyOrders}
        ctaA11y={`Lihat order saya, total ${formatIDR(order.total)}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1 },
  scrollPad: { paddingHorizontal: SPACING.screen, paddingTop: SPACING.screen, paddingBottom: SPACING.screen },
  title: { ...TYPO.title, color: COLORS.ink, marginBottom: SPACING.md, textAlign: 'center' },
  headRow: { flexDirection: 'row', alignItems: 'flex-start' },
  headInfo: { flex: 1 },
  amount: { ...TYPO.angka, color: COLORS.ink, marginTop: SPACING.sm },
  sub: { fontSize: 13, color: COLORS.muted, marginTop: 6 },
  group: { marginTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.line, paddingTop: SPACING.md },
  groupHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  groupTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.ink, marginRight: SPACING.sm },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.sm },
  itemName: { flex: 1, fontSize: 13, color: COLORS.ink, marginRight: SPACING.sm },
  itemSub: { fontSize: 13, fontWeight: '600', color: COLORS.ink },
  groupSubtotal: { fontSize: 13, fontWeight: '700', color: COLORS.brand700, marginTop: SPACING.sm, textAlign: 'right' },
  stub: { fontSize: 13, color: COLORS.pendingFg, marginTop: SPACING.md },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  feeLabel: { fontSize: 14, color: COLORS.muted },
  feeValue: { fontSize: 14, fontWeight: '700', color: COLORS.ink },
  feeNote: { fontSize: 12, color: COLORS.faint, marginTop: SPACING.xs },
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
