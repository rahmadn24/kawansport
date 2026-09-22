import React from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, View } from 'react-native';
import { formatIDR } from '../api/bookings';
import { ShopOrder, shopOrderStatusLabel } from '../api/shop';

interface Props {
  orders: ShopOrder[];
  loading: boolean;
  error: string | null;
  expandedId: string | null;
  onToggle: (id: string) => void;
  onRefresh: () => void;
}

/**
 * Layar Orders (MP-02): daftar order milik sendiri + rincian grup per seller
 * (expandable). Tanpa aksi cancel — order pending diselesaikan via pembayaran.
 */
export function MyOrdersScreen({ orders, loading, error, expandedId, onToggle, onRefresh }: Props) {
  if (loading && orders.length === 0) {
    return (
      <View style={styles.box}>
        <ActivityIndicator />
      </View>
    );
  }
  return (
    <View style={styles.box}>
      <Text style={styles.title}>Order Saya</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {orders.length === 0 && !loading ? (
        <Text style={styles.sub}>Belum ada order. Checkout dari keranjang dulu.</Text>
      ) : (
        orders.map((o) => (
          <View key={o.id} style={styles.card}>
            <Text style={styles.name}>
              {o.paymentRef} • {shopOrderStatusLabel(o.status)}
            </Text>
            <Text style={styles.sub}>
              {formatIDR(o.total)} • {o.groups.length} toko
            </Text>
            {expandedId === o.id
              ? o.groups.map((g) => (
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
                ))
              : null}
            <View style={styles.gap} />
            <Button
              title={expandedId === o.id ? 'Tutup Rincian' : 'Lihat Rincian'}
              onPress={() => onToggle(o.id)}
            />
          </View>
        ))
      )}
      <View style={styles.gap} />
      <Button title="Muat Ulang" onPress={onRefresh} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, padding: 24, justifyContent: 'flex-start' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  card: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, marginBottom: 12 },
  name: { fontSize: 14, fontWeight: '600' },
  sub: { fontSize: 13, color: '#555', marginTop: 4 },
  group: { marginTop: 8, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 8 },
  groupTitle: { fontSize: 14, fontWeight: '600' },
  error: { fontSize: 14, color: '#b00020', marginTop: 8, textAlign: 'center' },
  gap: { height: 12 },
});
