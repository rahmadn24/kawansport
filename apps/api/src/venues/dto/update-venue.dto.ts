import { Type } from 'class-transformer';
import {
  IsArray,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/** PATCH /venues/:id — semua field opsional; lat/lng wajib berpasangan. */
export class UpdateVenueDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lng?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sports?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];
}
