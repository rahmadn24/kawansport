import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

/**
 * GET /venues?sport=&lat=&lng=&radius=&page=&limit= (publik, hanya approved).
 * - sport: cocok satu elemen sports[] case-insensitive.
 * - lat/lng/radius: filter lingkaran; radius dalam METER (default 10000).
 *   Sort jarak ASC bila geo dipakai, selain itu createdAt ASC.
 * - Pagination: page 1-based, limit maks 50.
 */
export class ListVenuesDto {
  @IsOptional()
  @IsString()
  sport?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(100)
  @Max(100000)
  radius?: number;

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
