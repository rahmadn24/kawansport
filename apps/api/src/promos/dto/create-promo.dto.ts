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

/**
 * POST /promos (ST-09, khusus super_admin).
 * - `title`: 1..120 char.
 * - `imageUrl`: aturan ST-01 (path `/uploads/...` atau URL `https`).
 * - `link`: teks bebas opsional (deep-link / URL, maks 2048).
 * - `active`: default true.
 * - `startsAt/endsAt`: ISO opsional; bila keduanya diisi, startsAt <= endsAt.
 */
export class CreatePromoDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @IsString()
  @IsPhotoUrl()
  imageUrl!: string;

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
