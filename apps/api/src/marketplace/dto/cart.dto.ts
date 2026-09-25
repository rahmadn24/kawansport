import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

/**
 * PUT /cart — satu bentuk untuk add/update/remove/clear:
 * - `{ productId, qty (>0) }` = tambah/ubah; `{ productId, qty: 0 }` = hapus baris.
 * - `{ clear: true }` = kosongkan seluruh cart (productId/qty diabaikan).
 * - ST-05: `{ variantIndex? }` = indeks varian produk (0-based; absen =
 *   tanpa varian). Tiap (produk, varian) adalah baris cart tersendiri.
 */
export class UpdateCartDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  qty?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  variantIndex?: number;

  @IsOptional()
  @IsBoolean()
  clear?: boolean;
}
