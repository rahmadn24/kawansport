import { IsInt, Min } from 'class-validator';

/** Skor baru untuk fixture/match `pending` (EL-03). */
export class SetMatchScoreDto {
  @IsInt()
  @Min(0)
  scoreA!: number;

  @IsInt()
  @Min(0)
  scoreB!: number;
}
