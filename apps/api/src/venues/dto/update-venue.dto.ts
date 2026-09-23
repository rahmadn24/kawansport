import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { IsPhotoUrl } from '../../uploads/photo-url';

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
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @IsPhotoUrl({ each: true })
  photos?: string[];
}
