import { IsIn } from 'class-validator';

/** POST /matches/:id/walkover — pihak pemenang WO (EL-05, super_admin). */
export class WalkoverDto {
  @IsIn(['A', 'B'])
  winnerSide!: 'A' | 'B';
}
