import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PAYOUT_PAYEE_TYPES, PAYOUT_STATUSES } from '../payout.entity';
import type { PayoutPayeeType, PayoutStatus } from '../payout.entity';

/** POST /payouts/:id/approve — reference transfer manual opsional di tahap ini. */
export class ApprovePayoutDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reference?: string;
}

/** POST /payouts/:id/reject — alasan penolakan opsional. */
export class RejectPayoutDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

/** POST /payouts/:id/pay — tandai sudah ditransfer manual; reference WAJIB. */
export class PayPayoutDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  reference!: string;
}

/** GET /payouts?status= — filter antrean admin (opsional). */
export class ListPayoutsQueryDto {
  @IsOptional()
  @IsIn(PAYOUT_STATUSES)
  status?: PayoutStatus;
}

/**
 * GET /payouts/balance?payeeType=&payeeId= — wajib berpasangan bila diisi.
 * Tanpa query: agregat milik sendiri (mitra); super_admin wajib mengisi.
 */
export class BalanceQueryDto {
  @IsOptional()
  @IsIn(PAYOUT_PAYEE_TYPES)
  payeeType?: PayoutPayeeType;

  @IsOptional()
  @IsUUID()
  payeeId?: string;
}
