import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

/** Opsi sort untuk list ratings. */
export enum RatingSortBy {
  LATEST = 'latest',
  HIGHEST = 'highest',
  LOWEST = 'lowest',
}

/** GET /api/venues/:venueId/ratings atau /api/courts/:courtId/ratings — query params. */
export class ListRatingsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(RatingSortBy)
  sortBy?: RatingSortBy = RatingSortBy.LATEST;
}