import React from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, View } from 'react-native';
import { formatIDR } from '../api/bookings';
import { ShopCart } from '../api/shop';

interface Props {
  cart: ShopCart | null;
  loading: boolean;
  error: string | null;
  mutating: boolean;
  mutateError: string | null;
  onRefresh: () => void;
  onSetQty: (productId: string, qty: number) => void;
  onClear: () => void;
  onCheckout: () => void;
}

/**
 * Layar Cart (MP-02): daftar item multiseller + ubah qty / hapus / kosongkan.
 * Total dihitung server dari harga terkini (ditampilkan apa adanya).
 */
export function CartScreen({
  cart,
  loading,
  error,
  mutating,
  mutateError,
  onRefresh,
  onSetQty,
  onClear,
  onCheckout,
}: Props) {
  if (loading && !cart) {
    return (
      <View style={styles.box}>
        <ActivityIndicator />
      </View>
    );
  }
  if (error && !cart) {
    return (
      <View style={styles.box}>
        <Text style={styles.error}>{error}</Text>
        <View style={styles.gap} />
        <Button title="Coba Lagi" onPress={onRefresh} />
      </View>
    );
  }
  const items = cart?.items ?? [];
  return (
    <View style={styles.box}>
      <Text style={styles.title}>Keranjang</Text>
      {items.length === 0 ? (
        <Text style={styles.sub}>Keranjang kosong. Tambahkan produk dari daftar produk.</Text>
      ) : (
        items.map((line) => (
          <View key={line.productId} style={styles.card}>
            <Text style={styles.name}>{line.product.name || line.productId}</Text>
            {line.product.sellerShopName ? (
              <Text style={styles.sub}>{line.product.sellerShopName}</Text>
            ) : null}
            <Text style={styles.sub}>
              {formatIDR(line.product.price)} × {line.qty} ={' '}
              {formatIDR(line.product.price * line.qty)}
            </Text>
            {line.qty > line.product.stock ? (
              <Text style={styles.warn}>
                Stok tersisa {line.product.stock} — kurangi jumlah sebelum checkout.
              </Text>
            ) : null}
            <View style={styles.row}>
              <Button
                title="-"
                disabled={mutating}
                onPress={() => onSetQty(line.productId, line.qty - 1)}
              />
              <Text style={styles.qty}>{line.qty}</Text>
              <Button
                title="+"
                disabled={mutating}
                onPress={() => onSetQty(line.productId, line.qty + 1)}
              />
              <View style={styles.gapH} />
              <Button
                title="Hapus"
                disabled={mutating}
                onPress={() => onSetQty(line.productId, 0)}
              />
            </View>
          </View>
        ))
      )}
      {mutateError ? <Text style={styles.error}>{mutateError}</Text> : null}
      <Text style={styles.total}>Total: {formatIDR(cart?.total ?? 0)}</Text>
      <View style={styles.gap} />
      <Button
        title={mutating ? 'Memproses...' : 'Checkout'}
        disabled={items.length === 0 || mutating}
        onPress={onCheckout}
      />
      <View style={styles.gap} />
      <Button title="Kosongkan" disabled={items.length === 0 || mutating} onPress={onClear} />
      <View style={styles.gap} />
      <Button title="Muat Ulang" onPress={onRefresh} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, padding: 24, justifyContent: 'flex-start' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  card: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, marginBottom: 12 },
  name: { fontSize: 16, fontWeight: '600' },
  sub: { fontSize: 13, color: '#555', marginTop: 4 },
  warn: { fontSize: 13, color: '#b7791f', marginTop: 4 },
  error: { fontSize: 14, color: '#b00020', marginTop: 8, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  qty: { fontSize: 16, marginHorizontal: 12 },
  gapH: { width: 12 },
  total: { fontSize: 18, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  gap: { height: 12 },
});
