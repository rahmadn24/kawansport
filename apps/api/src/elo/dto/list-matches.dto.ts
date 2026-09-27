import { IsIn, IsOptional } from 'class-validator';
import { MATCH_STATUSES, type MatchStatus } from '../match-result.entity';

export class ListMatchesDto {
  @IsOptional()
  @IsIn(MATCH_STATUSES)
  status?: MatchStatus;
}
