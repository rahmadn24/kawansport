import { Type } from 'class-transformer';
import {
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

  @IsOptional()
  @IsObject()
  openHours?: Record<string, unknown>;

  @IsOptional()
  @IsIn(COURT_STATUSES)
  status?: string;
}
