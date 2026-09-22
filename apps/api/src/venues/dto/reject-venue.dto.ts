import { IsOptional, IsString, MaxLength } from 'class-validator';

/** POST /venues/:id/reject — alasan penolakan (opsional, tersimpan). */
export class RejectVenueDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
