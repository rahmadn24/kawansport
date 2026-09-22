import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

/**
 * GET /events?sport=&from=&to=&lat=&lng=&radius=&page=&limit=.
 * - sport: cocok persis case-insensitive.
 * - from/to: rentang ISO 8601 untuk kolom datetime.
 * - lat/lng/radius: filter lingkaran; radius dalam METER (default 10000).
 *   lat/lng tanpa radius tetap memfilter dengan radius default.
 * - Sort selalu datetime ASC. Pagination: page 1-based, limit maks 50.
 */
export class ListEventsDto {
  @IsOptional()
  @IsString()
  sport?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

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
