import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsPhotoUrl } from '../../uploads/photo-url';
import { PRODUCT_BADGES } from '../product.entity';
import { ProductVariantDto } from './product-variant.dto';

/** PATCH /products/:id — semua field opsional. */
export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  price?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @IsPhotoUrl({ each: true })
  photos?: string[];

  /** Varian produk (ST-05, opsional, maks 10; mengganti total). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  variants?: ProductVariantDto[];

  /** Badge tampilan (ST-05, manual; `null` = hapus badge). */
  @IsOptional()
  @IsString()
  @IsIn([...PRODUCT_BADGES])
  badge?: string | null;
}
