import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** GET /venues/:id/leaderboard — filter publik per venue (EL-02). */
export class VenueLeaderboardQueryDto {
  /** Cabor (case-insensitive, ≤60). Kosong = semua cabor (elo → null). */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  sport?: string;

  /** Batas baris (default 20, 1..100). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
