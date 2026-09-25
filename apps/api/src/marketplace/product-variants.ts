import { BadRequestException } from '@nestjs/common';
import {
  MAX_PRODUCT_VARIANTS,
  PRODUCT_BADGES,
  Product,
  ProductBadge,
  ProductVariant,
} from './product.entity';

/**
 * Helper murni ST-05 (varian + badge produk). Modul tanpa dependensi
 * Nest/service agar bisa dipakai dua arah: ProductsService (path edit
 * langsung), ChangeRequestsService (apply saat admin approve), CartService
 * dan OrdersService (harga/stok per varian) — tanpa circular import.
 */

export interface VariantInput {
  name?: unknown;
  priceDelta?: unknown;
  stock?: unknown;
}

/**
 * Normalisasi + validasi varian produk.
 * null/undefined/[] = tanpa varian (disimpan null). Maks 10 varian.
 * Tiap varian: name wajib (1..60 char setelah trim), priceDelta int
 * (default 0), stock opsional int >= 0. Invalid → 400.
 */
export function normalizeProductVariants(
  input: Array<VariantInput | null> | null | undefined,
): ProductVariant[] | null {
  if (input == null) return null;
  if (!Array.isArray(input)) {
    throw new BadRequestException('Product variants must be an array');
  }
  if (input.length > MAX_PRODUCT_VARIANTS) {
    throw new BadRequestException(
      `Product variants must not exceed ${MAX_PRODUCT_VARIANTS} items`,
    );
  }
  if (input.length === 0) return null;
  return input.map((raw, i) => {
    const name = String(raw?.name ?? '').trim();
    if (!name || name.length > 60) {
      throw new BadRequestException(
        `Product variant #${i + 1}: name is required (max 60 characters)`,
      );
    }
    const deltaRaw = raw?.priceDelta;
    const priceDelta =
      deltaRaw === undefined || deltaRaw === null ? 0 : Number(deltaRaw);
    if (!Number.isInteger(priceDelta)) {
      throw new BadRequestException(
        `Product variant #${i + 1}: priceDelta must be an integer`,
      );
    }
    const stockRaw = raw?.stock;
    let stock: number | null = null;
    if (stockRaw !== undefined && stockRaw !== null) {
      stock = Number(stockRaw);
      if (!Number.isInteger(stock) || stock < 0) {
        throw new BadRequestException(
          `Product variant #${i + 1}: stock must be an integer >= 0`,
        );
      }
    }
    return { name, priceDelta, stock };
  });
}

/**
 * Normalisasi badge: null/'' = tanpa badge; selain itu wajib salah satu
 * dari PRODUCT_BADGES, else 400.
 */
export function normalizeProductBadge(input: unknown): ProductBadge | null {
  if (input === null || input === undefined) return null;
  const s = String(input).trim();
  if (!s) return null;
  if (!(PRODUCT_BADGES as string[]).includes(s)) {
    throw new BadRequestException(
      `Product badge must be one of: ${PRODUCT_BADGES.join(', ')}`,
    );
  }
  return s as ProductBadge;
}

/**
 * Harga satuan untuk baris (produk + varian). variantIndex -1/absen =
 * harga dasar; else harga dasar + priceDelta. Indeks di luar rentang → 400.
 */
export function unitPriceFor(
  product: Pick<Product, 'price' | 'variants'>,
  variantIndex?: number | null,
): number {
  const variants = product.variants ?? [];
  if (
    variantIndex === undefined ||
    variantIndex === null ||
    variantIndex === -1
  ) {
    return product.price;
  }
  const v = variants[variantIndex];
  if (!v) {
    throw new BadRequestException('Product variant not found');
  }
  return product.price + (v.priceDelta ?? 0);
}

/**
 * Stok efektif untuk baris (produk + varian): stok varian bila varian
 * punya `stock`, else stok dasar produk.
 */
export function effectiveStockFor(
  product: Pick<Product, 'stock' | 'variants'>,
  variantIndex?: number | null,
): number {
  const variants = product.variants ?? [];
  if (
    variantIndex !== undefined &&
    variantIndex !== null &&
    variantIndex !== -1
  ) {
    const v = variants[variantIndex];
    if (!v) {
      throw new BadRequestException('Product variant not found');
    }
    if (v.stock !== undefined && v.stock !== null) return v.stock;
  }
  return product.stock;
}

/** Nama varian untuk snapshot, atau null bila tanpa varian. */
export function variantNameFor(
  product: Pick<Product, 'variants'>,
  variantIndex?: number | null,
): string | null {
  const variants = product.variants ?? [];
  if (
    variantIndex === undefined ||
    variantIndex === null ||
    variantIndex === -1
  ) {
    return null;
  }
  const v = variants[variantIndex];
  if (!v) {
    throw new BadRequestException('Product variant not found');
  }
  return v.name;
}

/**
 * Assert indeks varian valid untuk produk ini (400 bila di luar rentang;
 * 400 bila produk tanpa varian tetapi variantIndex >= 0 diberikan).
 */
export function assertValidVariantIndex(
  product: Pick<Product, 'variants'>,
  variantIndex?: number | null,
): void {
  if (
    variantIndex === undefined ||
    variantIndex === null ||
    variantIndex === -1
  ) {
    return;
  }
  const variants = product.variants ?? [];
  if (
    !Number.isInteger(variantIndex) ||
    variantIndex < 0 ||
    !variants[variantIndex]
  ) {
    throw new BadRequestException('Product variant not found');
  }
}
