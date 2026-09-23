import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/**
 * POST /checkout — body opsional redeem promo (ST-04).
 * Tanpa body / field kosong = checkout normal seperti sebelumnya (MP-02).
 */
export class CheckoutDto {
  /** Kode voucher (case-insensitive, dinormalisasi ke uppercase di service). */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  voucherCode?: string;

  /** Poin Kawan dipakai, 1 poin = Rp1, dibatasi sisa total setelah voucher. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  usePoints?: number;
}
