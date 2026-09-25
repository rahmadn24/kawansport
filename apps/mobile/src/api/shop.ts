/**
 * API marketplace MP-02: cart multiseller, checkout, orders per seller.
 *
 * Fungsi menerima http client opsional agar mudah diuji (default: api).
 */
import { api } from './client';

export interface ShopProductVariant {
  name: string;
  priceDelta: number;
  stock?: number | null;
}

/** Badge kurasi manual seller (ST-05; null = tanpa badge). */
export type ShopProductBadge = 'original' | 'best_seller' | 'baru';

export interface ShopCartProduct {
  id: string;
  sellerId: string;
  sellerShopName: string;
  /** ST-05: toko terverifikasi admin. */
  sellerVerified?: boolean;
  name: string;
  /** ST-05: harga SATUAN sudah termasuk priceDelta varian baris ini. */
  price: number;
  /** ST-05: stok efektif (stok varian bila ada, else stok dasar). */
  stock: number;
  status: string;
  /** ST-05: badge kurasi manual seller (null = tanpa badge). */
  badge?: ShopProductBadge | null;
  /** ST-05: daftar varian produk (untuk picker katalog). */
  variants?: ShopProductVariant[];
  /** ST-01: foto produk (path /uploads/... atau https). Absen pada respons lama. */
  photos?: string[];
}

export interface ShopCartLine {
  productId: string;
  qty: number;
  /** ST-05: indeks varian (-1/absen = tanpa varian). */
  variantIndex?: number;
  /** ST-05: snapshot nama varian (null bila tanpa varian). */
  variantName?: string | null;
  product: ShopCartProduct;
}

export interface ShopCart {
  items: ShopCartLine[];
  total: number;
  count: number;
}

export type ShopOrderStatus = 'pending' | 'paid' | 'expired' | 'cancelled';

export interface ShopOrderItem {
  productId: string;
  productName: string;
  qty: number;
  price: number;
  subtotal: number;
  /** ST-05: indeks varian (-1 = tanpa varian). */
  variantIndex?: number;
  /** ST-05: snapshot nama varian (null bila tanpa varian). */
  variantName?: string | null;
}

export interface ShopOrderGroup {
  id: string;
  sellerId: string;
  sellerShopName: string;
  subtotal: number;
  status: ShopOrderStatus;
  items: ShopOrderItem[];
}

/** ST-05: cara serah terima (pickup bebas ongkir). */
export type ShopFulfillment = 'pickup' | 'delivery';

/** Maksimal ongkir manual per order (ST-05, rupiah). */
export const MAX_DELIVERY_FEE = 100000;

export interface ShopOrder {
  id: string;
  userId: string;
  paymentRef: string;
  channel: string;
  status: ShopOrderStatus;
  total: number;
  snapToken: string | null;
  redirectUrl: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  groups: ShopOrderGroup[];
  /** ST-04: snapshot akuntansi (subtotal → diskon voucher → poin → total). */
  subtotal?: number;
  discount?: number;
  voucherCode?: string | null;
  pointsUsed?: number;
  /** ST-05: cara serah terima (snapshot; default pickup). */
  fulfillment?: ShopFulfillment;
  /** ST-05: snapshot ongkir rupiah (0 bila pickup). */
  deliveryFee?: number;
}

/** ST-04: body opsional checkout (tanpa body = checkout normal MP-02). */
export interface CheckoutOptions {
  voucherCode?: string;
  usePoints?: number;
  /** ST-05: cara serah terima (default pickup = ambil di toko). */
  fulfillment?: ShopFulfillment;
  /** ST-05: ongkir manual info toko (0..100rb, hanya untuk delivery). */
  deliveryFee?: number;
}

interface Http {
  get<T>(url: string, config?: { params?: unknown }): Promise<{ data: T }>;
  post<T>(url: string, body: unknown): Promise<{ data: T }>;
  put<T>(url: string, body: unknown): Promise<{ data: T }>;
}

/** GET /cart — cart aktif milik sendiri. */
export async function getCart(http: Http = api): Promise<ShopCart> {
  const res = await http.get<ShopCart>('/cart');
  return res.data;
}

/**
 * PUT /cart — tambah/ubah jumlah (`qty > 0`), hapus baris (`qty = 0`).
 * Hanya produk approved yang bisa masuk (server 404 bila tidak tersedia).
 * ST-05: `variantIndex?` (0-based) memilih varian — tiap (produk, varian)
 * adalah baris tersendiri; indeks invalid → 400 dari server.
 */
export async function setCartItem(
  productId: string,
  qty: number,
  http: Http = api,
  variantIndex?: number,
): Promise<ShopCart> {
  const res = await http.put<ShopCart>('/cart', {
    productId,
    qty,
    ...(variantIndex === undefined ? {} : { variantIndex }),
  });
  return res.data;
}

/** PUT /cart { clear: true } — kosongkan seluruh cart. */
export async function clearCart(http: Http = api): Promise<ShopCart> {
  const res = await http.put<ShopCart>('/cart', { clear: true });
  return res.data;
}

/** POST /checkout — checkout atomik → 1 order + N grup seller + Snap. */
export async function checkoutCart(
  http: Http = api,
  options?: CheckoutOptions,
): Promise<ShopOrder> {
  const res = await http.post<ShopOrder>('/checkout', options ?? {});
  return res.data;
}

/** GET /orders/me — daftar order milik sendiri. */
export async function listMyOrders(http: Http = api): Promise<ShopOrder[]> {
  const res = await http.get<{ data: ShopOrder[] }>('/orders/me');
  return res.data.data;
}

/** GET /orders/:id — detail order milik sendiri. */
export async function getOrderDetail(
  id: string,
  http: Http = api,
): Promise<ShopOrder> {
  const res = await http.get<ShopOrder>(`/orders/${id}`);
  return res.data;
}

/** Label status order Bahasa Indonesia untuk UI. */
export function shopOrderStatusLabel(status: ShopOrderStatus): string {  switch (status) {
    case 'pending':
      return 'Menunggu bayar';
    case 'paid':
      return 'Lunas';
    case 'expired':
      return 'Kedaluwarsa';
    case 'cancelled':
      return 'Dibatalkan';
    default:
      return status;
  }
}

/** Validasi sisi klien sebelum ubah cart; pesan error atau null bila valid. */
export function validateCartQty(qty: number): string | null {
  if (!Number.isInteger(qty) || qty < 0) return 'Jumlah harus bilangan bulat >= 0';
  if (qty > 999) return 'Jumlah maksimal 999';
  return null;
}

/** ST-05: label badge produk Bahasa Indonesia (null = tanpa badge). */
export function productBadgeLabel(
  badge: ShopProductBadge | null | undefined,
): string | null {
  switch (badge) {
    case 'original':
      return 'Original';
    case 'best_seller':
      return 'Terlaris';
    case 'baru':
      return 'Baru';
    default:
      return null;
  }
}

/** ST-05: label fulfillment Bahasa Indonesia untuk UI. */
export function fulfillmentLabel(fulfillment: ShopFulfillment): string {
  return fulfillment === 'delivery' ? 'Diantar' : 'Ambil di toko';
}

/**
 * ST-05: validasi ongkir sisi klien; pesan error atau null bila valid.
 * Aturan server: pickup wajib fee 0; delivery 0..100rb.
 */
export function validateDeliveryFee(
  fulfillment: ShopFulfillment,
  deliveryFee: number,
): string | null {
  if (!Number.isInteger(deliveryFee) || deliveryFee < 0) {
    return 'Ongkir harus bilangan bulat >= 0';
  }
  if (fulfillment === 'pickup' && deliveryFee !== 0) {
    return 'Ambil di toko bebas ongkir';
  }
  if (deliveryFee > MAX_DELIVERY_FEE) {
    return `Ongkir maksimal Rp${MAX_DELIVERY_FEE.toLocaleString('id-ID')}`;
  }
  return null;
}

/** ST-05: label varian baris cart ("Varian: XL" atau null bila tanpa varian). */
export function cartLineVariantLabel(
  variantName: string | null | undefined,
): string | null {
  return variantName ? `Varian: ${variantName}` : null;
}
