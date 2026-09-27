import { IsIn } from 'class-validator';

/**
 * POST /matches/:id/resolve-dispute — putusan admin atas match `disputed`
 * (EL-05, super_admin). `confirm` = skor sah → confirmed + ELO;
 * `cancel` = walkover/batal → cancelled tanpa ELO.
 */
export class ResolveDisputedMatchDto {
  @IsIn(['confirm', 'cancel'])
  decision!: 'confirm' | 'cancel';
}
