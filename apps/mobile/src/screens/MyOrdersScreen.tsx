import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { formatIDR } from '../api/bookings';
import { ShopOrder, ShopOrderStatus, shopOrderStatusLabel } from '../api/shop';
import { COLORS, RADIUS, SPACING, TYPO, formatWIB } from '../theme';
import {
  UIBadge,
  UIEmptyState,
  UIErrorBanner,
  UIHeader,
  UISegmented,
} from '../components/ui';
import { orderBadgeKind } from '../mocks/stitch';

interface Props {
  orders: ShopOrder[];
  loading: boolean;
  error: string | null;
  expandedId: string | null;
  onToggle: (id: string) => void;
  onRefresh: () => void;
}

/**
 * Layar Orders (MP-02, Stitch UX-03): badge status berwarna + nama toko
 * real + filter segmented + rincian grup per seller (FlatList).
 * Tanpa aksi cancel — order pending diselesaikan via pembayaran.
 */
export function MyOrdersScreen({ orders, loading, error, expandedId, onToggle, onRefresh }: Props) {
  const [filter, setFilter] = useState<ShopOrderStatus | null>(null);
  const shown = filter ? orders.filter((o) => o.status === filter) : orders;

  if (loading && orders.length === 0) {
    return (
      <View style={styles.screen}>
        <UIHeader locationText="Sekitarmu" />
        <View style={styles.content}>
          <ActivityIndicator accessibilityLabel="Memuat order" />
        </View>
      </View>
    );
  }
  return (
    <View style={styles.screen}>
      <UIHeader locationText="Sekitarmu" />
      <View style={styles.content}>
        <Text style={styles.title}>Order Saya</Text>

      <UISegmented<ShopOrderStatus>
        label="Saring status order"
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

      {error ? <UIErrorBanner message={error} actionLabel="Coba lagi" onAction={onRefresh} /> : null}
      {shown.length === 0 && !loading ? (
        <UIEmptyState
          illustration="📦"
          title="Belum ada order"
          message={
            filter
              ? 'Tidak ada order dengan status ini.'
              : 'Checkout dari keranjang dulu.'
          }
          actionLabel="Muat Ulang"
          onAction={onRefresh}
        />
      ) : (
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listPad}
          data={shown}
          keyExtractor={(o) => o.id}
          onRefresh={onRefresh}
          refreshing={loading}
          renderItem={({ item: o }) => {
            const expanded = expandedId === o.id;
            return (
              <View style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={styles.cardHead}>
                    <Text style={styles.name} numberOfLines={1}>
                      Order {o.paymentRef}
                    </Text>
                    <Text style={styles.sub}>
                      {formatIDR(o.total)} • {o.groups.length} toko • {formatWIB(o.createdAt)}
                    </Text>
                  </View>
                  <UIBadge kind={orderBadgeKind(o.status)} label={shopOrderStatusLabel(o.status)} />
                </View>
                {expanded
                  ? o.groups.map((g) => (
                      <View key={g.id} style={styles.group}>
                        <View style={styles.groupHead}>
                          <Text style={styles.groupTitle} numberOfLines={1}>
                            {g.sellerShopName || 'Toko'}
                          </Text>
                          <UIBadge
                            kind={orderBadgeKind(g.status)}
                            label={shopOrderStatusLabel(g.status)}
                          />
                        </View>
                        {g.items.map((it) => (
                          <View key={it.productId} style={styles.itemRow}>
                            <Text style={styles.itemName} numberOfLines={2}>
                              {it.productName} × {it.qty}
                            </Text>
                            <Text style={styles.itemSub}>{formatIDR(it.subtotal)}</Text>
                          </View>
                        ))}
                        <Text style={styles.groupSubtotal}>
                          Subtotal: {formatIDR(g.subtotal)}
                        </Text>
                      </View>
                    ))
                  : null}
                {expanded && o.status === 'pending' ? (
                  o.redirectUrl ? (
                    <TouchableOpacity
                      style={styles.payBtn}
                      onPress={() => Linking.openURL(o.redirectUrl as string).catch(() => undefined)}
                      accessibilityRole="button"
                      accessibilityLabel={`Bayar order ${o.paymentRef}, total ${formatIDR(o.total)}`}
                    >
                      <Text style={styles.payBtnText}>Bayar</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.waitPay}>Menunggu link bayar…</Text>
                  )
                ) : null}
                <View style={styles.gap} />
                <TouchableOpacity
                  style={styles.toggleBtn}
                  onPress={() => onToggle(o.id)}
                  accessibilityRole="button"
                  accessibilityLabel={expanded ? `Tutup rincian order ${o.paymentRef}` : `Lihat rincian order ${o.paymentRef}`}
                >
                  <Text style={styles.toggleText}>
                    {expanded ? 'Tutup Rincian' : 'Lihat Rincian'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}
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
  name: { fontSize: 14, fontWeight: '700', color: COLORS.ink },
  sub: { fontSize: 13, color: COLORS.muted, marginTop: 4 },
  group: { marginTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.line, paddingTop: SPACING.md },
  groupHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  groupTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.ink, marginRight: SPACING.sm },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.sm },
  itemName: { flex: 1, fontSize: 13, color: COLORS.ink, marginRight: SPACING.sm },
  itemSub: { fontSize: 13, fontWeight: '600', color: COLORS.ink },
  groupSubtotal: { fontSize: 13, fontWeight: '700', color: COLORS.brand700, marginTop: SPACING.sm, textAlign: 'right' },
  gap: { height: SPACING.md },
  payBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.full,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.md,
  },
  payBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.bg },
  waitPay: { fontSize: 13, color: COLORS.muted, marginTop: SPACING.md, textAlign: 'center' },
  toggleBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.brand700,
    borderRadius: RADIUS.full,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleText: { fontSize: 14, fontWeight: '700', color: COLORS.brand700 },
});
