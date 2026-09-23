import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * POST /courts/:id/blocks (API-W06) — owner menutup slot (mis. maintenance).
 * `date` wajib `YYYY-MM-DD`; penanda awal salah satu dari:
 * - `start: "HH:MM"` (mis. "08:00"), atau
 * - `startMinute` (mis. 480).
 * `durationMinutes` opsional, default 60 (boleh >60 untuk menutup beberapa
 * slot sekaligus). `reason` opsional (maks 255 char).
 */
export class CreateBlockDto {
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

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
