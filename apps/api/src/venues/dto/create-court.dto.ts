import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { COURT_STATUSES } from '../court.entity';

/** POST /venues/:id/courts — court milik venue, dibuat owner/admin venue. */
export class CreateCourtDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  sport!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  pricePerHour!: number;

  /**
   * Fasilitas spesifik court (ST-10, opsional, allowlist sama dengan venue).
   * Normalisasi + tolak asing 400 di service.
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  facilities?: string[];

  @IsOptional()
  @IsObject()
  openHours?: Record<string, unknown>;

  @IsOptional()
  @IsIn(COURT_STATUSES)
  status?: string;
}
