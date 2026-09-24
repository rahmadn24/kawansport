/**
 * API marketplace MP-02: cart multiseller, checkout, orders per seller.
 *
 * Fungsi menerima http client opsional agar mudah diuji (default: api).
 */
import { api } from './client';

export interface ShopCartProduct {
  id: string;
  sellerId: string;
  sellerShopName: string;
  name: string;
  price: number;
  stock: number;
  status: string;
  /** ST-01: foto produk (path /uploads/... atau https). Absen pada respons lama. */
  photos?: string[];
}

export interface ShopCartLine {
  productId: string;
  qty: number;
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
}

export interface ShopOrderGroup {
  id: string;
  sellerId: string;
  sellerShopName: string;
  subtotal: number;
  status: ShopOrderStatus;
  items: ShopOrderItem[];
}

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
}

/** ST-04: body opsional checkout (tanpa body = checkout normal MP-02). */
export interface CheckoutOptions {
  voucherCode?: string;
  usePoints?: number;
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
 */
export async function setCartItem(
  productId: string,
  qty: number,
  http: Http = api,
): Promise<ShopCart> {
  const res = await http.put<ShopCart>('/cart', { productId, qty });
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
export function shopOrderStatusLabel(status: ShopOrderStatus): string {
  switch (status) {
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
