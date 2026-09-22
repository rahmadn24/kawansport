import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

/**
 * POST /bookings — booking satu slot lapangan.
 * `date` wajib `YYYY-MM-DD`; penanda slot salah satu dari:
 * - `start: "HH:MM"` (mis. "08:00"), atau
 * - `startMinute` (mis. 480).
 * `durationMinutes` opsional, default 60 (keputusan PO, sama seperti hold).
 */
export class CreateBookingDto {
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
}
