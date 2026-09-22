import { Type } from 'class-transformer';
import {
  IsArray,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

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

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];
}
