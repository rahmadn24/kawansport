import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsPhotoUrl } from '../../uploads/photo-url';
import { PRODUCT_BADGES } from '../product.entity';
import { ProductVariantDto } from './product-variant.dto';

/** POST /products — seller yang sudah approved; produk langsung `pending`. */
export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  category!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  price!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock!: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @IsPhotoUrl({ each: true })
  photos?: string[];

  /**
   * Varian produk (ST-05, opsional, maks 10).
   * Harga satuan = price + priceDelta; stok per varian bila `stock` diisi.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  variants?: ProductVariantDto[];

  /**
   * Badge tampilan (ST-05, manual oleh seller; tanpa badge = field absen).
   * `best_seller` adalah kurasi manual, bukan komputasi penjualan.
   */
  @IsOptional()
  @IsString()
  @IsIn([...PRODUCT_BADGES])
  badge?: string;
}
