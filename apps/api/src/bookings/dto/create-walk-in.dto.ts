import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * POST /bookings/walk-in (API-W06) — owner mencatat booking langsung di tempat.
 * `buyerName` wajib (teks nama pembeli); `amount` opsional (default = harga
 * court prorata durasi, TANPA service fee — fee hanya untuk kanal `app`).
 * Slot mengikuti aturan yang sama dengan booking app (open hours + anti double).
 */
export class CreateWalkInDto {
  @IsUUID()
  courtId!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be YYYY-MM-DD',
  })
  date!: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'start must be HH:MM (00:00-23:59)',
  })
  start?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(24 * 60 - 1)
  startMinute?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(24 * 60)
  durationMinutes?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  buyerName!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  amount?: number;
}
