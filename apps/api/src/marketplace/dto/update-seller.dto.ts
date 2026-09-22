import { IsOptional, IsString, MaxLength } from 'class-validator';

/** PATCH /sellers/me — semua field opsional. */
export class UpdateSellerDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  shopName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
