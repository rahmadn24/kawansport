import {
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  DISPUTE_CATEGORIES,
  DISPUTE_TARGET_TYPES,
} from '../dispute.entity';
import type {
  DisputeCategory,
  DisputeTargetType,
} from '../dispute.entity';

/** POST /disputes — buat laporan untuk diri sendiri (user login). */
export class CreateDisputeDto {
  @IsString()
  @IsIn(DISPUTE_TARGET_TYPES)
  targetType!: DisputeTargetType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  targetId!: string;

  @IsString()
  @IsIn(DISPUTE_CATEGORIES)
  category!: DisputeCategory;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description!: string;
}
