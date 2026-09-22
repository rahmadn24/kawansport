import { IsDateString, IsOptional } from 'class-validator';

/** Query GET /admin/stats — rentang ISO 8601 opsional; string invalid -> 400 via ValidationPipe global. */
export class AdminStatsQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
