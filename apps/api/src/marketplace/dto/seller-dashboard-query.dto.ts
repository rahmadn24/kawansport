import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Pagination standar dashboard toko seller:
 * - GET /products/mine (semua status milik sendiri).
 * - GET /orders/seller (grup order milik sendiri).
 * page 1-based, limit maks 50 (selaras ListProductsDto).
 */
export class SellerDashboardQueryDto {
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
