import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SKILL_LEVELS, SkillLevel } from '../user.entity';

export const SPORT_MAX_COUNT = 20;
export const SPORT_MAX_LENGTH = 40;

/** PATCH /me — semua field opsional; lat & lng wajib berpasangan (dicek di service). */
export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(SPORT_MAX_COUNT)
  @IsString({ each: true })
  @MaxLength(SPORT_MAX_LENGTH, { each: true })
  sports?: string[];

  @IsOptional()
  @IsIn([...SKILL_LEVELS])
  skillLevel?: SkillLevel;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'lat must be a number' })
  @Min(-90)
  @Max(90)
  lat?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'lng must be a number' })
  @Min(-180)
  @Max(180)
  lng?: number | null;
}
