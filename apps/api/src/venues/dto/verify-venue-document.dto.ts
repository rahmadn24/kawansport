import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * POST /venues/:id/documents/:docId/verify — verifikasi admin.
 * Hanya `verified | rejected` (pending = status awal, tidak bisa di-set ulang).
 */
export class VerifyVenueDocumentDto {
  @IsString()
  @IsIn(['verified', 'rejected'])
  status!: 'verified' | 'rejected';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
