import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { IsPhotoUrl } from '../../uploads/photo-url';

/**
 * PATCH /events/:id — host memperbarui title/deskripsi/foto (ST-01).
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
}
