import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

/**
 * GET /promos?all= (ST-09).
 * - Tanpa `all`: publik, hanya banner aktif dalam periode.
 * - `all=true`: khusus super_admin — semua banner (untuk CMS kelola).
 */
export class ListPromosDto {
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  all?: boolean;
}
