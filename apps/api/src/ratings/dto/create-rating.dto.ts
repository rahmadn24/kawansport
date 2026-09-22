import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

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
}