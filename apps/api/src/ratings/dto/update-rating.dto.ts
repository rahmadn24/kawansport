import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsPhotoUrl } from '../../uploads/photo-url';
import { ReviewAspectsDto } from './review-aspects.dto';

/** PUT /api/ratings/:id — body untuk update rating/review (semua opsional, min 1). */
export class UpdateRatingDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  score?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;

  /** Foto review (ST-01): path /uploads/... atau https, maks 3. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  @IsPhotoUrl({ each: true })
  photos?: string[];

  /**
   * Aspek penilaian (ST-06): { lapangan?, cahaya?, bersih?, staf? },
   * masing-masing 1..5, semua opsional (parsial OK). Mengganti total
   * (bukan merge) bila dikirim; `null` menghapus semua aspek.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => ReviewAspectsDto)
  aspects?: ReviewAspectsDto | null;

  /**
   * Tag sorotan (ST-06): maks 5 x 30 char, dinormalisasi
   * lowercase-trim. Mengganti total bila dikirim.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  tags?: string[];

  /**
   * Mode anonim (ST-06): bila true, respons publik menyamarkan user
   * jadi "Anonim" + avatar null (owner + admin tetap lihat asli).
   */
  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;
}