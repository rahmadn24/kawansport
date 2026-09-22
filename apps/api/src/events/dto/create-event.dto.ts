import { Type } from 'class-transformer';
import {
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
}
