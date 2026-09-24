import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsPhotoUrl } from '../../uploads/photo-url';

/**
 * PATCH /events/:id — host memperbarui title/deskripsi/foto/fee (ST-01+ST-02).
 * Kapasitas & jadwal tidak bisa diubah di sini (menjaga invarian
 * participants_count/status dan booking event yang sudah ada).
 */
export class UpdateEventDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  /** Foto event (ST-01): path /uploads/... atau https, maks 5. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @IsPhotoUrl({ each: true })
  photos?: string[];

  /**
   * Iuran join rupiah, IDR only (ST-02, >= 0). Payment pending yang sudah
   * terbit memakai snapshot lama (tidak ikut berubah).
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000000000)
  fee?: number;
}
