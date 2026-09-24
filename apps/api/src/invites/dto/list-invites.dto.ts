import { IsIn, IsOptional } from 'class-validator';

export class ListInvitesDto {
  /** Default `in` (untukku); `sent` = keluar (dariku). */
  @IsOptional()
  @IsIn(['in', 'sent'])
  dir?: 'in' | 'sent';
}
