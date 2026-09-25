import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MAX_DELIVERY_FEE, SHOP_FULFILLMENTS } from '../shop-order.entity';

/**
 * POST /checkout — body opsional promo (ST-04) + fulfillment (ST-05).
 * Tanpa body / field kosong = checkout normal seperti sebelumnya (MP-02).
 *
 * ST-05 fulfillment:
 * - `pickup` (default) = ambil di toko, bebas ongkir (`deliveryFee` wajib 0).
 * - `delivery` = diantar + ongkir manual info toko (`deliveryFee` 0..100rb,
 *   snapshot ke order; TIDAK bisa dibayar voucher/poin — fee ditambah di
 *   atas total setelah diskon, pola service fee API-W03).
 */
export class CheckoutDto {
  /** Kode voucher (case-insensitive, dinormalisasi ke uppercase di service). */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  voucherCode?: string;

  /** Poin Kawan dipakai, 1 poin = Rp1, dibatasi sisa subtotal setelah voucher. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  usePoints?: number;

  /** Cara serah terima (default `pickup`). */
  @IsOptional()
  @IsString()
  @IsIn([...SHOP_FULFILLMENTS])
  fulfillment?: string;

  /** Ongkir manual rupiah (hanya untuk `delivery`, maks 100rb). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_DELIVERY_FEE)
  deliveryFee?: number;
}
