import { IsIn, IsOptional } from 'class-validator';
import { DISPUTE_STATUSES } from '../dispute.entity';

/** Query GET /disputes — filter status opsional (khusus super_admin). */
export class ListDisputesQueryDto {
  @IsOptional()
  @IsIn(DISPUTE_STATUSES)
  status?: string;
}
