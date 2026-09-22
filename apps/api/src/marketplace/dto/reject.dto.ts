import { IsOptional, IsString, MaxLength } from 'class-validator';

/** POST /sellers/:id/reject + POST /products/:id/reject — alasan opsional. */
export class RejectDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
