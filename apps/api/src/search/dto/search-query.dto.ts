import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * GET /search?q=&lat=&lng=&radius=&limit= (ST-09, publik tanpa auth —
 * sama seperti list venue/produk yang publik).
 * - `q`: substring case-insensitive atas nama/deskripsi (venue + event +
 *   produk). Kosong = semua (dibatasi `limit`).
 * - `lat`+`lng` (berpasangan; sebelah saja → 400 via validasi manual):
 *   filter lingkaran `radius` meter (default 10000) untuk venue/event
 *   (produk tak punya koordinat — selalu ikut tanpa jarak), tiap item
 *   berkoordinat dapat `distanceMeters`, sort jarak ASC (produk tanpa
 *   jarak di belakang, abjad).
 * - Tanpa geo: sort abjad (title ASC).
 * - `limit`: default 20, maks 50.
 */
export class SearchQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

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
  @Max(50)
  limit?: number;
}
