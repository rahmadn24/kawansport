import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { IsPhotoUrl } from '../../uploads/photo-url';

/** POST /venues — owner otomatis = current user (JWT). */
export class CreateVenueDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address!: string;

  @Type(() => Number)
  @IsLatitude()
  lat!: number;

  @Type(() => Number)
  @IsLongitude()
  lng!: number;

  @IsArray()
  @IsString({ each: true })
  sports!: string[];

  /**
   * Fasilitas venue (ST-10, opsional): subset allowlist
   * (parkir, shower, wifi, kantin, mushola, toilet, loker, tribun).
   * Normalisasi + tolak asing 400 di service.
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  facilities?: string[];

  /** Foto venue (ST-01): path /uploads/... atau https, maks 5. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @IsPhotoUrl({ each: true })
  photos?: string[];
}
