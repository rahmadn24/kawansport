import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsPhotoUrl } from '../../uploads/photo-url';

/** PATCH /promos/:id (ST-09, khusus super_admin) — semua field parsial. */
export class UpdatePromoDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @IsPhotoUrl()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  link?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;
}
