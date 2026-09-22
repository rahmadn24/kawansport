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
 * POST /events/:id/book — booking satu slot lapangan untuk event (BK-04).
 * Isi sama seperti POST /bookings: `courtId` + `date` (YYYY-MM-DD, wajib hari
 * yang sama dengan datetime event) + penanda slot salah satu dari:
 * - `start: "HH:MM"` (mis. "08:00"), atau
 * - `startMinute` (mis. 480).
 * `durationMinutes` opsional, default 60.
 */
export class BookEventDto {
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
