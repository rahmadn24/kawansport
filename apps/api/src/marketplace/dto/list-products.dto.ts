import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

/**
 * GET /products?search=&category=&seller=&page=&limit= (publik, hanya approved).
 * - search: substring case-insensitive atas name + description.
 * - category: cocok persis case-insensitive.
 * - seller: filter sellerId (UUID).
 * - Pagination: page 1-based, limit maks 50.
 */
export class ListProductsDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsUUID()
  seller?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
