import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { COURT_STATUSES } from '../court.entity';

/** PATCH /venues/:id/courts/:courtId — semua field opsional. */
export class UpdateCourtDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  sport?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  pricePerHour?: number;

  /**
   * Fasilitas court (ST-10, AD-02 non-sensitif → langsung berlaku).
   * Nilai asing → 400 (lihat `facilities.ts`).
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
