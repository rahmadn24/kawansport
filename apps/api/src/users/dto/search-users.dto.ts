import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SKILL_LEVELS, SkillLevel } from '../user.entity';

/**
 * GET /users/search?sport=&skill=&lat=&lng=&radius=&page=&limit= (SM-06).
 * - sport: cocok ke SATU item di kolom sports[] user (case-insensitive).
 * - skill: cocok persis skillLevel.
 * - lat/lng/radius: filter lingkaran; radius dalam METER (default 10000).
 *   lat/lng wajib berpasangan (dicek di service -> 400 bila timpang).
 * - Sort selalu jarak ASC bila geo dipakai, selain itu createdAt ASC.
 * - Pagination: page 1-based, limit maks 50.
 */
export class SearchUsersDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  sport?: string;

  @IsOptional()
  @IsIn([...SKILL_LEVELS])
  skill?: SkillLevel;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(100)
  @Max(100000)
  radius?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
