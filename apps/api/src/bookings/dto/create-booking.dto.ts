import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Satu item sewa dalam POST /bookings (ST-10, opsional).
 * Validasi bisnis di service: milik venue court tsb (else 400) + stok
 * cukup + aktif (else 409). Stok hanya dicek, tidak di-decrement.
 */
export class BookingRentalDto {
  @IsUUID()
  rentalId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999)
  qty!: number;
}

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

  /**
   * Kode voucher (ST-04, opsional, case-insensitive → uppercase di service).
   * Urutan akuntansi: subtotal → diskon voucher → poin → total.
   */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  voucherCode?: string;

  /** Poin Kawan dipakai, 1 poin = Rp1 (ST-04, opsional, default 0). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  usePoints?: number;

  /**
   * Item sewa opsional (ST-10, upsell di slot picker mobile).
   * Duplikat `rentalId` digabung (qty dijumlah) di service.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => BookingRentalDto)
  rentals?: BookingRentalDto[];
}
