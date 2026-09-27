import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateTournamentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  sport!: string;

  @IsOptional()
  @IsUUID()
  venueId?: string;

  /**
   * Peserta turnamen (min 3, maks 16). Creator TIDAK otomatis termasuk —
   * client memasukkan id creator secara eksplisit bila ikut main.
   */
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(16)
  @IsUUID(undefined, { each: true })
  participantIds!: string[];
}
