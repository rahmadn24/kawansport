import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { VOUCHER_SCOPES, VOUCHER_TYPES } from '../voucher.entity';

/**
 * PATCH /admin/vouchers/:id — semua field opsional (ST-04, super_admin).
 * Ditulis manual (tanpa @nestjs/mapped-types yang belum jadi dependensi).
 */
export class UpdateVoucherDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  code?: string;

  @IsOptional()
  @IsIn(VOUCHER_TYPES)
  type?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  value?: number;

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
