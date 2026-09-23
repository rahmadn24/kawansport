import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { VOUCHER_SCOPES, VOUCHER_TYPES } from '../voucher.entity';

/** POST /admin/vouchers — body pembuatan voucher (ST-04, super_admin). */
export class CreateVoucherDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  code!: string;

  @IsIn(VOUCHER_TYPES)
  type!: string;

  /** persen 1..100 bila percent; rupiah >=1 bila fixed (rentang akhir di service). */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  value!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxDiscount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minTransaction?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  quota?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  perUserLimit?: number;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validTo?: string;

  @IsOptional()
  @IsIn(VOUCHER_SCOPES)
  applicableTo?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
