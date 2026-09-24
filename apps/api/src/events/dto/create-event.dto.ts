import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsPhotoUrl } from '../../uploads/photo-url';

/** POST /events — host otomatis = current user (JWT). */
export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  sport!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  /** ISO 8601, mis. 2026-10-01T09:00:00+07:00. */
  @IsDateString()
  datetime!: string;

  @Type(() => Number)
  @IsLatitude()
  lat!: number;

  @Type(() => Number)
  @IsLongitude()
  lng!: number;

  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(500)
  capacity!: number;

  /**
   * Iuran join rupiah, IDR only (ST-02). Opsional, default 0 = gratis.
   * Pending payment TIDAK makan slot; peserta dihitung setelah paid.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000000000)
  fee?: number;

  /** Foto event (ST-01): path /uploads/... atau https, maks 5. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @IsPhotoUrl({ each: true })
  photos?: string[];
}
