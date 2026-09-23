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
}