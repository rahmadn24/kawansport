import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Satu varian produk (ST-05): `{ name, priceDelta?, stock? }`.
 * - `name`: wajib, maks 60 char (mis. "Ukuran 42", "Merah").
 * - `priceDelta`: selisih rupiah thd harga dasar (boleh negatif), default 0.
 * - `stock`: stok khusus varian (opsional; bila absen, stok dasar dipakai).
 */
export class ProductVariantDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  priceDelta?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock?: number;
}
