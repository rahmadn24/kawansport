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
 * GET /users/search?sport=&skill=&lat=&lng=&radius=&page=&limit= (SM-06)
 * + filter ELO EL-01 (eloSport=&eloMin=&eloMax=&eloMaxDelta=).
 * - sport: cocok ke SATU item di kolom sports[] user (case-insensitive).
 * - skill: cocok persis skillLevel.
 * - lat/lng/radius: filter lingkaran; radius dalam METER (default 10000).
 *   lat/lng wajib berpasangan (dicek di service -> 400 bila timpang).
 * - eloSport: cabor acuan rating ELO (case-insensitive, maks 60 char).
 *   eloMin/eloMax = rentang skor eksplisit; eloMaxDelta = alternatif
 *   (rentang [skorku-delta, skorku+delta]). Default bila eloSport diisi
 *   tanpa ketiganya: skorku ±100 (skor 1000 provisional untuk yang belum
 *   punya rating — ikut hasil + ditandai). Detail di service + ENDPOINTS.md.
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

  /**
   * EL-01: cabor acuan rating ELO (case-insensitive). Bila diisi, tiap item
   * hasil memuat `elo: { sport, score, provisional }`.
   */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  eloSport?: string;

  /** EL-01: batas bawah skor ELO inklusif (wajib bareng eloSport). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  eloMin?: number;

  /** EL-01: batas atas skor ELO inklusif (wajib bareng eloSport). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  eloMax?: number;

  /**
   * EL-01: alternatif eloMin/eloMax — delta maks dari skorku
   * (rentang [skorku-delta, skorku+delta]). Default 100 bila eloSport
   * diisi tanpa eloMin/eloMax/eloMaxDelta.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  eloMaxDelta?: number;
}
