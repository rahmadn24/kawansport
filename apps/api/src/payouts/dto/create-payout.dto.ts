import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { PAYOUT_PAYEE_TYPES } from '../payout.entity';
import type { PayoutPayeeType } from '../payout.entity';

/** POST /payouts — mitra (atau super_admin) mengajukan withdraw. */
export class CreatePayoutDto {
  @IsIn(PAYOUT_PAYEE_TYPES)
  payeeType!: PayoutPayeeType;

  @IsUUID()
  payeeId!: string;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bankName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  accountNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  accountName?: string;
}
