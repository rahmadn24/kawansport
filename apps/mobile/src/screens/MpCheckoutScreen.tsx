import React from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import { formatIDR } from '../api/bookings';
import { ShopOrder, shopOrderStatusLabel } from '../api/shop';

interface Props {
  order: ShopOrder;
  onDone: () => void;
  onMyOrders: () => void;
}

/**
 * Layar Checkout marketplace (MP-02): ringkasan 1 order + N grup seller
 * beserta info bayar Snap. Mode stub dijelaskan sama seperti CheckoutScreen
 * booking (BK-03/BK-04).
 */
export function MpCheckoutScreen({ order, onDone, onMyOrders }: Props) {
  const isStub = (order.snapToken ?? '').startsWith('stub-snap-');
  return (
    <View style={styles.box}>
      <Text style={styles.title}>Checkout Berhasil</Text>
      <View style={styles.card}>
        <Text style={styles.row}>Status: {shopOrderStatusLabel(order.status)}</Text>
        <Text style={styles.amount}>{formatIDR(order.total)}</Text>
        <Text style={styles.sub}>Order: {order.paymentRef}</Text>
        {order.groups.map((g) => (
          <View key={g.id} style={styles.group}>
            <Text style={styles.groupTitle}>
              {g.sellerShopName || g.sellerId} • {formatIDR(g.subtotal)} •{' '}
              {shopOrderStatusLabel(g.status)}
            </Text>
            {g.items.map((it) => (
              <Text key={it.productId} style={styles.sub}>
                {it.productName} × {it.qty} = {formatIDR(it.subtotal)}
              </Text>
            ))}
          </View>
        ))}
        {order.redirectUrl ? <Text style={styles.sub}>Bayar: {order.redirectUrl}</Text> : null}
        {order.snapToken ? <Text style={styles.sub}>Snap token: {order.snapToken}</Text> : null}
        {isStub ? (
          <Text style={styles.stub}>
            Mode stub (tanpa Midtrans server key): selesaikan pembayaran via webhook
            settlement di server untuk menandai lunas.
          </Text>
        ) : null}
      </View>
      <View style={styles.gap} />
      <Button title="Lihat Order Saya" onPress={onMyOrders} />
      <View style={styles.gap} />
      <Button title="Kembali ke Keranjang" onPress={onDone} />
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
  group: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 8 },
  groupTitle: { fontSize: 14, fontWeight: '600' },
  stub: { fontSize: 13, color: '#b7791f', marginTop: 12 },
  gap: { height: 12 },
});
