import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { formatIDR } from '../api/bookings';
import { ShopCart } from '../api/shop';
import { COLORS, RADIUS, SPACING, TYPO, initialsOf } from '../theme';
import {
  UICard,
  UIChip,
  UIEmptyState,
  UIErrorBanner,
  UISearchBar,
  UIStickyBar,
} from '../components/ui';
import {
  STITCH_PICKUP_BANNER,
  STITCH_SHOP_CATEGORIES,
  filterCartLocal,
  groupCartBySeller,
} from '../mocks/stitch';

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
 * Layar Cart (MP-02, Stitch UX-03): search lokal + chip kategori + banner
 * pickup + grup per seller + stepper + rincian + sticky Checkout.
 *
 * - Search & kategori = filter LOKAL display-only (tak menyentuh server).
 * - Badge verified DISEMBUNYIKAN (TODO ST-05) — jangan tampilkan badge palsu.
 * - Gambar produk = placeholder lokal (TODO ST-01).
 * - Shipping & voucher DISEMBUNYIKAN (TODO ST-05 / ST-04).
 * - Total sticky dari server (cart.total).
 */
// TODO(ST-01): foto produk asli dari API media.
// TODO(ST-05): seller verified + opsi shipping dari API marketplace kaya.
// TODO(ST-09): search/katalog + banner promo dari API.
// TODO(ST-04): voucher/poin — section disembunyikan sampai API ada.
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
  const [query, setQuery] = useState('');
  const [catIndex, setCatIndex] = useState(0);
  const category = STITCH_SHOP_CATEGORIES[catIndex] ?? STITCH_SHOP_CATEGORIES[0];

  const items = useMemo(
    () => filterCartLocal(cart?.items ?? [], query, category),
    [cart, query, category],
  );
  const groups = useMemo(() => groupCartBySeller(items), [items]);
  // Total dari server — JANGAN dihitung ulang dari mock.
  const total = cart?.total ?? 0;
  const count = cart?.count ?? 0;

  if (error && !cart) {
    return (
      <View style={styles.box}>
        <Text style={styles.title}>Keranjang</Text>
        <UIErrorBanner message={error} actionLabel="Coba Lagi" onAction={onRefresh} />
      </View>
    );
  }

  return (
    <View style={styles.box}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollPad}>
        <Text style={styles.title}>Keranjang Gear</Text>

        {/* Search lokal */}
        <UISearchBar
          value={query}
          onChange={setQuery}
          placeholder="Cari raket, sepatu, jersey..."
          accessibilityLabel="Cari di keranjang"
        />

        {/* Chip kategori (filter lokal) */}
        <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Kategori gear">
          {STITCH_SHOP_CATEGORIES.map((c, i) => (
            <UIChip
              key={c.label}
              label={c.label}
              active={i === catIndex}
              onPress={() => setCatIndex(i)}
            />
          ))}
        </View>

        {/* Banner pickup statis */}
        <View style={styles.banner} accessibilityRole="text">
          <View style={styles.bannerIcon} accessibilityElementsHidden>
            <Text style={styles.bannerIconText}>🏸</Text>
          </View>
          <View style={styles.bannerBody}>
            <Text style={styles.bannerTitle}>{STITCH_PICKUP_BANNER.title}</Text>
            <Text style={styles.bannerMsg} numberOfLines={2}>
              {STITCH_PICKUP_BANNER.message}
            </Text>
          </View>
        </View>

        <View style={styles.cartHead}>
          <Text style={styles.cartCount}>
            {count > 0 ? `(${count} Produk Siap)` : ''}
          </Text>
          {count > 0 ? (
            <TouchableOpacity
              onPress={onClear}
              disabled={mutating}
              accessibilityRole="button"
              accessibilityLabel="Hapus semua item keranjang"
              style={styles.clearBtn}
            >
              <Text style={styles.clearText}>🗑 Hapus Semua</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {(cart?.items ?? []).length === 0 && !loading ? (
          <UIEmptyState
            illustration="🛍"
            title="Keranjang kosong"
            message="Tambahkan produk dari daftar produk dulu."
            actionLabel="Muat Ulang"
            onAction={onRefresh}
          />
        ) : items.length === 0 ? (
          <UIEmptyState
            illustration="🔍"
            title="Tidak ketemu"
            message="Coba kata kunci atau kategori lain."
          />
        ) : (
          groups.map((g) => (
            <UICard key={g.sellerId} style={styles.groupCard}>
              <View style={styles.sellerRow}>
                <Text style={styles.sellerName} numberOfLines={1}>
                  {g.sellerShopName || 'Toko'}
                </Text>
                {/* TODO(ST-05): badge verified DISEMBUNYIKAN sampai API ada. */}
                <Text style={styles.sellerMeta}>{g.lines.length} produk</Text>
              </View>
              {g.lines.map((line) => (
                <View key={line.productId} style={styles.item}>
                  {/* Placeholder gambar lokal (TODO ST-01), bukan foto palsu. */}
                  <View style={styles.thumb} accessibilityElementsHidden>
                    <Text style={styles.thumbText}>
                      {initialsOf(line.product.name || line.productId)}
                    </Text>
                  </View>
                  <View style={styles.itemBody}>
                    <View style={styles.itemTop}>
                      <Text style={styles.itemName} numberOfLines={2}>
                        {line.product.name || line.productId}
                      </Text>
                      <TouchableOpacity
                        onPress={() => onSetQty(line.productId, 0)}
                        disabled={mutating}
                        accessibilityRole="button"
                        accessibilityLabel={`Hapus ${line.product.name || 'produk'} dari keranjang`}
                        style={styles.delBtn}
                      >
                        <Text style={styles.delText}>🗑</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.itemVar} numberOfLines={1}>
                      {line.product.sellerShopName}
                      {line.product.stock <= 5 ? ` • Stok tersisa ${line.product.stock}` : ''}
                    </Text>
                    {line.qty > line.product.stock ? (
                      <Text style={styles.warn}>
                        Stok tersisa {line.product.stock} — kurangi jumlah sebelum checkout.
                      </Text>
                    ) : null}
                    <View style={styles.itemBottom}>
                      <Text style={styles.itemPrice}>{formatIDR(line.product.price)}</Text>
                      <View style={styles.stepper}>
                        <TouchableOpacity
                          style={styles.stepBtn}
                          onPress={() => onSetQty(line.productId, line.qty - 1)}
                          disabled={mutating}
                          accessibilityRole="button"
                          accessibilityLabel={`Kurangi ${line.product.name || 'produk'}`}
                        >
                          <Text style={styles.stepText}>−</Text>
                        </TouchableOpacity>
                        <Text style={styles.qty}>{line.qty}</Text>
                        <TouchableOpacity
                          style={styles.stepBtn}
                          onPress={() => onSetQty(line.productId, line.qty + 1)}
                          disabled={mutating}
                          accessibilityRole="button"
                          accessibilityLabel={`Tambah ${line.product.name || 'produk'}`}
                        >
                          <Text style={styles.stepText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </UICard>
          ))
        )}

        {/* TODO(ST-05): section shipping DISEMBUNYIKAN. TODO(ST-04): voucher DISEMBUNYIKAN. */}

        {mutateError ? <Text style={styles.error}>{mutateError}</Text> : null}
        <UIErrorBanner message={loading ? null : error} actionLabel="Coba lagi" onAction={onRefresh} />

        {/* Rincian: total server + catatan ambil-di-toko */}
        {count > 0 ? (
          <UICard>
            <Text style={styles.rincTitle}>Rincian Pembayaran</Text>
            <View style={styles.rincRow}>
              <Text style={styles.rincLabel}>Total ({count} produk)</Text>
              <Text style={styles.rincValue}>{formatIDR(total)}</Text>
            </View>
            <Text style={styles.rincNote}>
              Diambil di toko (default sementara — menunggu ST-05).
            </Text>
          </UICard>
        ) : null}
        <View style={styles.bottomPad} />
      </ScrollView>

      {/* Sticky: total server + Checkout oranye */}
      {count > 0 ? (
        <UIStickyBar
          totalLabel={`Total Tagihan (${count} Gear)`}
          totalValue={formatIDR(total)}
          ctaTitle={`Checkout Gear (${count})`}
          onCta={onCheckout}
          ctaDisabled={mutating}
          ctaLoading={mutating}
          ctaA11y={`Checkout, total ${formatIDR(total)}`}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, backgroundColor: COLORS.bg, paddingTop: SPACING.screen },
  scroll: { flex: 1 },
  scrollPad: { paddingHorizontal: SPACING.screen, paddingBottom: SPACING.screen },
  title: { ...TYPO.title, color: COLORS.ink, marginBottom: SPACING.md, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: SPACING.md },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.brand100,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  bannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.brand700,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  bannerIconText: { fontSize: 20 },
  bannerBody: { flex: 1 },
  bannerTitle: { fontSize: 11, fontWeight: '800', color: COLORS.brand700, textTransform: 'uppercase' },
  bannerMsg: { fontSize: 13, color: COLORS.ink, marginTop: 2 },
  cartHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  cartCount: { fontSize: 13, fontWeight: '600', color: COLORS.brand700 },
  clearBtn: { minHeight: 44, justifyContent: 'center' },
  clearText: { fontSize: 12, fontWeight: '700', color: COLORS.danger },
  groupCard: { marginBottom: SPACING.md },
  sellerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  sellerName: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.ink },
  sellerMeta: { fontSize: 12, color: COLORS.faint, marginLeft: SPACING.sm },
  item: { flexDirection: 'row', marginTop: SPACING.md },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.brand900,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  thumbText: { color: COLORS.lime, fontSize: 18, fontWeight: '800' },
  itemBody: { flex: 1 },
  itemTop: { flexDirection: 'row', alignItems: 'flex-start' },
  itemName: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.ink, marginRight: SPACING.sm },
  delBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  delText: { fontSize: 18 },
  itemVar: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  warn: { fontSize: 12, color: COLORS.pendingFg, marginTop: 4 },
  itemBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.sm },
  itemPrice: { fontSize: 15, fontWeight: '800', color: COLORS.brand700 },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bgAlt, borderRadius: RADIUS.sm, padding: 4 },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { fontSize: 20, fontWeight: '700', color: COLORS.ink },
  qty: { fontSize: 14, fontWeight: '800', color: COLORS.ink, marginHorizontal: SPACING.md, minWidth: 24, textAlign: 'center' },
  rincTitle: { fontSize: 14, fontWeight: '700', color: COLORS.ink, marginBottom: SPACING.sm },
  rincRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rincLabel: { fontSize: 13, color: COLORS.muted },
  rincValue: { fontSize: 14, fontWeight: '700', color: COLORS.ink },
  rincNote: { fontSize: 12, color: COLORS.faint, marginTop: SPACING.sm },
  error: { fontSize: 14, color: COLORS.danger, marginTop: SPACING.sm, textAlign: 'center' },
  bottomPad: { height: SPACING.md },
});
