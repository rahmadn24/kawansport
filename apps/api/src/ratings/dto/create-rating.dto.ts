import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsPhotoUrl } from '../../uploads/photo-url';

/** POST /api/ratings — body untuk membuat rating (+ review opsional). */
export class CreateRatingDto {
  @IsUUID()
  @IsNotEmpty()
  venueId!: string;

  @IsOptional()
  @IsUUID()
  courtId?: string | null;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  score!: number;

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