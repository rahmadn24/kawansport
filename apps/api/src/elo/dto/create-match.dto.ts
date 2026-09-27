import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateMatchDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  sport!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  teamA!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  teamB!: string[];

  @IsInt()
  @Min(0)
  scoreA!: number;

  @IsInt()
  @Min(0)
  scoreB!: number;

  @IsOptional()
  @IsUUID()
  venueId?: string;
}
