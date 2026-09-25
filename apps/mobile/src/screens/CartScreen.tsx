import React, { useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { formatIDR } from '../api/bookings';
import {
  ShopCart,
  ShopFulfillment,
  cartLineVariantLabel,
  fulfillmentLabel,
  productBadgeLabel,
  validateDeliveryFee,
} from '../api/shop';
import { firstPhoto, resolvePhotoUrl } from '../api/photos';
import { formatPoints } from '../api/vouchers';
import { COLORS, RADIUS, SPACING, TYPO, initialsOf } from '../theme';
import {
  UICard,
  UIChip,
  UIEmptyState,
  UIErrorBanner,
  UISearchBar,
  UIStickyBar,
  UITextInput,
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
  onSetQty: (productId: string, qty: number, variantIndex?: number) => void;
  onClear: () => void;
  onCheckout: () => void;
  /** ST-04: kode voucher (diterapkan server saat checkout). */
  voucherCode?: string;
  onVoucherCodeChange?: (code: string) => void;
  /** ST-04: saldo Poin Kawan (1 poin = Rp1); null = belum termuat. */
  loyaltyBalance?: number | null;
  loyaltyError?: string | null;
  /** ST-05: cara serah terima (default pickup = ambil di toko). */
  fulfillment?: ShopFulfillment;
  onFulfillmentChange?: (f: ShopFulfillment) => void;
  /** ST-05: ongkir manual rupiah (hanya untuk delivery, maks 100rb). */
  deliveryFee?: number;
  onDeliveryFeeChange?: (fee: number) => void;
}

/**
 * Layar Cart (MP-02, Stitch UX-03): search lokal + chip kategori + banner
 * pickup + grup per seller + stepper + rincian + sticky Checkout.
 *
 * - Search & kategori = filter LOKAL display-only (tak menyentuh server).
 * - ST-05 real: badge produk + verified toko dari server (tanpa klaim palsu:
 *   hanya tampil bila server mengirimnya), label varian per baris, dan
 *   pilihan pickup/delivery + ongkir (diteruskan ke POST /checkout).
 * - Gambar produk: foto pertama ST-01 bila ada, else placeholder inisial jujur.
 *   Upload baru disabled (POST /uploads butuh file picker native).
 * - Voucher ST-04 real: kode dikirim ke POST /checkout, diskon dibaca dari
 *   snapshot order; saldo poin dari GET /me (empty/error jujur bila gagal).
 * - Total sticky dari server (cart.total).
 */
// TODO(ST-01-upload): upload foto produk baru (POST /uploads) butuh file picker native.
// TODO(ST-09): search/katalog + banner promo dari API.
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
  voucherCode = '',
  onVoucherCodeChange = () => undefined,
  loyaltyBalance = null,
  loyaltyError = null,
  fulfillment = 'pickup',
  onFulfillmentChange = () => undefined,
  deliveryFee = 0,
  onDeliveryFeeChange = () => undefined,
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
  // ST-05: validasi ongkir sisi klien (server tetap validasi ulang).
  const feeError = validateDeliveryFee(fulfillment, deliveryFee);

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
                {/* ST-05: verified real dari server — hanya tampil bila true. */}
                {g.lines.some((l) => l.product.sellerVerified) ? (
                  <Text style={styles.verified} accessibilityRole="text">
                    ✓ Terverifikasi
                  </Text>
                ) : null}
                <Text style={styles.sellerMeta}>{g.lines.length} produk</Text>
              </View>
              {g.lines.map((line) => (
                <View key={`${line.productId}#${line.variantIndex ?? -1}`} style={styles.item}>
                  {/* ST-01: foto produk pertama bila ada, else inisial (jujur). */}
                  {(() => {
                    const thumb = firstPhoto(line.product.photos);
                    return thumb ? (
                      <Image
                        source={{ uri: resolvePhotoUrl(thumb) }}
                        style={styles.thumbPhoto}
                        accessibilityRole="image"
                        accessibilityLabel={`Foto ${line.product.name || 'produk'}`}
                      />
                    ) : (
                      <View style={styles.thumb} accessibilityElementsHidden>
                        <Text style={styles.thumbText}>
                          {initialsOf(line.product.name || line.productId)}
                        </Text>
                      </View>
                    );
                  })()}
                  <View style={styles.itemBody}>
                    <View style={styles.itemTop}>
                      <Text style={styles.itemName} numberOfLines={2}>
                        {line.product.name || line.productId}
                      </Text>
                      {/* ST-05: badge kurasi seller — hanya tampil bila ada. */}
                      {(() => {
                        const badge = productBadgeLabel(line.product.badge);
                        return badge ? (
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>{badge}</Text>
                          </View>
                        ) : null;
                      })()}
                      <TouchableOpacity
                        onPress={() => onSetQty(line.productId, 0, line.variantIndex ?? -1)}
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
                      {(() => {
                        const v = cartLineVariantLabel(line.variantName);
                        return v ? ` • ${v}` : '';
                      })()}
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
                          onPress={() => onSetQty(line.productId, line.qty - 1, line.variantIndex ?? -1)}
                          disabled={mutating}
                          accessibilityRole="button"
                          accessibilityLabel={`Kurangi ${line.product.name || 'produk'}`}
                        >
                          <Text style={styles.stepText}>−</Text>
                        </TouchableOpacity>
                        <Text style={styles.qty}>{line.qty}</Text>
                        <TouchableOpacity
                          style={styles.stepBtn}
                          onPress={() => onSetQty(line.productId, line.qty + 1, line.variantIndex ?? -1)}
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
              <View style={styles.sellerSub}>
                <Text style={styles.sellerSubLabel}>
                  Subtotal toko ({g.lines.reduce((n, l) => n + l.qty, 0)} item)
                </Text>
                <Text style={styles.sellerSubValue}>{formatIDR(g.subtotal)}</Text>
              </View>
            </UICard>
          ))
        )}

        {/* ST-05: pilihan serah terima — pickup bebas ongkir, delivery + ongkir info toko. */}
        {count > 0 ? (
          <UICard>
            <Text style={styles.rincTitle}>Pengiriman</Text>
            {(['pickup', 'delivery'] as const).map((f) => (
              <TouchableOpacity
                key={f}
                style={styles.shipRow}
                onPress={() => onFulfillmentChange(f)}
                disabled={mutating}
                accessibilityRole="radio"
                accessibilityState={{ checked: fulfillment === f }}
                accessibilityLabel={fulfillmentLabel(f)}
              >
                <Text style={styles.shipRadio}>
                  {fulfillment === f ? '●' : '○'}
                </Text>
                <View style={styles.shipBody}>
                  <Text style={styles.shipLabel}>{fulfillmentLabel(f)}</Text>
                  <Text style={styles.shipSub}>
                    {f === 'pickup'
                      ? 'Ambil langsung di toko — bebas ongkir'
                      : 'Diantar ke alamatmu — ongkir sesuai info toko'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
            {fulfillment === 'delivery' ? (
              <UITextInput
                label="Ongkir (Rp, sesuai info toko, maks 100rb)"
                placeholder="cth. 10000"
                value={String(deliveryFee)}
                onChangeText={(t) => {
                  const n = Number(t.replace(/[^0-9]/g, ''));
                  onDeliveryFeeChange(Number.isFinite(n) ? n : 0);
                }}
                keyboardType="numeric"
                testID="cart-delivery-fee"
              />
            ) : null}
            {feeError ? (
              <Text style={styles.voucherError}>⚠ {feeError}</Text>
            ) : null}
            <Text style={styles.rincNote}>
              Ongkir tidak bisa dibayar voucher/poin — ditambah di atas total
              setelah diskon (dihitung server saat checkout).
            </Text>
          </UICard>
        ) : null}

        {/* ST-04: voucher & poin — kode dikirim saat checkout, diskon dari server. */}
        {count > 0 ? (
          <UICard>
            <Text style={styles.rincTitle}>Voucher & Poin</Text>
            <UITextInput
              label="Kode voucher (opsional)"
              placeholder="cth. HEMAT10"
              value={voucherCode}
              onChangeText={onVoucherCodeChange}
              autoCapitalize="characters"
              testID="cart-voucher-code"
            />
            {loyaltyError ? (
              <Text style={styles.voucherError}>⚠ {loyaltyError}</Text>
            ) : loyaltyBalance != null ? (
              <Text style={styles.voucherMeta}>
                Poin Kawan kamu: {formatPoints(loyaltyBalance)}
              </Text>
            ) : (
              <Text style={styles.voucherMeta}>Memuat saldo poin…</Text>
            )}
            <Text style={styles.rincNote}>
              Diskon & poin dihitung server saat checkout — rincian final ada di layar berikutnya.
            </Text>
          </UICard>
        ) : null}

        {mutateError ? <Text style={styles.error}>{mutateError}</Text> : null}
        <UIErrorBanner message={loading ? null : error} actionLabel="Coba lagi" onAction={onRefresh} />

        {/* Rincian: total server + catatan serah terima */}
        {count > 0 ? (
          <UICard>
            <Text style={styles.rincTitle}>Rincian Pembayaran</Text>
            <View style={styles.rincRow}>
              <Text style={styles.rincLabel}>Subtotal Gear ({count} item)</Text>
              <Text style={styles.rincValue}>{formatIDR(total)}</Text>
            </View>
            {fulfillment === 'delivery' && deliveryFee > 0 ? (
              <View style={styles.rincRow}>
                <Text style={styles.rincLabel}>Ongkir (estimasi)</Text>
                <Text style={styles.rincValue}>{formatIDR(deliveryFee)}</Text>
              </View>
            ) : null}
            <Text style={styles.rincNote}>
              {fulfillmentLabel(fulfillment)}
              {fulfillment === 'delivery'
                ? ' — ongkir final dihitung server saat checkout.'
                : ' (default — menunggu info toko untuk delivery).'}
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
  sellerSub: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
  },
  sellerSubLabel: { fontSize: 13, color: COLORS.muted },
  sellerSubValue: { fontSize: 14, fontWeight: '700', color: COLORS.ink },
  sellerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  sellerName: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.ink },
  verified: { fontSize: 12, fontWeight: '700', color: COLORS.brand700, marginLeft: SPACING.sm },
  badge: {
    backgroundColor: COLORS.brand100,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: SPACING.sm,
  },
  badgeText: { fontSize: 11, fontWeight: '800', color: COLORS.brand700 },
  shipRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8 },
  shipRadio: { fontSize: 16, color: COLORS.brand700, marginRight: SPACING.sm, marginTop: 2 },
  shipBody: { flex: 1 },
  shipLabel: { fontSize: 14, fontWeight: '700', color: COLORS.ink },
  shipSub: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  sellerMeta: { fontSize: 12, color: COLORS.faint, marginLeft: SPACING.sm },
  item: { flexDirection: 'row', marginTop: SPACING.md },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.brand900,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  thumbText: { color: COLORS.lime, fontSize: 20, fontWeight: '800' },
  thumbPhoto: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.line,
    marginRight: SPACING.md,
  },
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
  voucherError: { fontSize: 13, color: COLORS.danger, marginTop: SPACING.sm },
  voucherMeta: { fontSize: 13, color: COLORS.brand700, fontWeight: '600', marginTop: SPACING.sm },
  error: { fontSize: 14, color: COLORS.danger, marginTop: SPACING.sm, textAlign: 'center' },
  bottomPad: { height: SPACING.md },
});
