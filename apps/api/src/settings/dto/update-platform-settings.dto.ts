import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

/**
 * PUT /admin/settings — semua field opsional (API-W03, super_admin).
 * Kunci asing ditolak 400 oleh service (allowlist SETTING_KEYS) — global
 * ValidationPipe `whitelist` tidak memblokirnya, jadi cek eksplisit di sana.
 */

/** boolean-ish: true/false, "true"/"false", 1/0, "1"/"0" (selain itu 400). */
function toBooleanish(value: unknown): unknown {
  if (typeof value === 'boolean') return value;
  if (value === 1) return true;
  if (value === 0) return false;
  if (typeof value === 'string') {
    const s = value.trim().toLowerCase();
    if (s === 'true' || s === '1') return true;
    if (s === 'false' || s === '0') return false;
  }
  return value;
}

/** Integer dari number/string numerik; null/undefined/'' diteruskan apa adanya. */
function toIntegerOrPassthrough(value: unknown): unknown {
  if (value === undefined || value === null || value === '') return value;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const t = value.trim();
    if (t === '') return value;
    const n = Number(t);
    if (Number.isInteger(n)) return n;
  }
  return value;
}

/** Number dari number/string numerik; '' -> null (clear promo). */
function toNumberOrNull(value: unknown): unknown {
  if (value === undefined || value === null) return value;
  if (value === '') return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const t = value.trim();
    if (t === '') return null;
    const n = Number(t);
    if (!Number.isNaN(n)) return n;
  }
  return value;
}

/** ISO date string; '' -> null (clear promo). */
function toDateStringOrNull(value: unknown): unknown {
  if (value === undefined || value === null) return value;
  if (value === '') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
}

export class UpdatePlatformSettingsDto {
  @IsOptional()
  @Transform(({ value }) => toBooleanish(value))
  @IsBoolean()
  service_fee_enabled?: boolean;

  @IsOptional()
  @Transform(({ value }) => toIntegerOrPassthrough(value))
  @IsInt()
  @Min(0)
  service_fee_amount?: number;

  @IsOptional()
  @Transform(({ value }) => toNumberOrNull(value))
  @IsNumber()
  @Min(0)
  @Max(100)
  commission_percent?: number;

  @IsOptional()
  @Transform(({ value }) => toNumberOrNull(value))
  @IsNumber()
  @Min(0)
  @Max(100)
  commission_promo_percent?: number | null;

  @IsOptional()
  @Transform(({ value }) => toDateStringOrNull(value))
  @IsDateString()
  commission_promo_until?: string | null;
}
