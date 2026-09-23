import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * POST /disputes/:id/resolve — putusan admin.
 * `resolution` wajib bila `status=resolved` (dicek di service agar pesan
 * 400 eksplisit); opsional bila `rejected`.
 */
export class ResolveDisputeDto {
  @IsString()
  @IsIn(['resolved', 'rejected'])
  status!: 'resolved' | 'rejected';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  resolution?: string;
}
