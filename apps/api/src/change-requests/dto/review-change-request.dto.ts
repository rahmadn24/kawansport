import { IsOptional, IsString, MaxLength } from 'class-validator';

/** POST .../reject — alasan opsional (disimpan sebagai jejak audit). */
export class ReviewChangeRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
