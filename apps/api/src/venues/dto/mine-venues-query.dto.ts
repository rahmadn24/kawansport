import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

/**
 * GET /venues/mine?all=true (API-W05).
 * `all` hanya bermakna untuk super_admin (lihat semua venue);
 * venue_owner yang mengirim `all=true` → 403.
 */
export class MineVenuesQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  all?: boolean;
}
