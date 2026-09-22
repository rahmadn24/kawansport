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
 * - `{ productId, qty (>0) }` = tambah/ubah jumlah.
 * - `{ productId, qty: 0 }` = hapus baris produk tsb.
 * - `{ clear: true }` = kosongkan seluruh cart (productId/qty diabaikan).
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
  @IsBoolean()
  clear?: boolean;
}
