import { IsOptional, IsString } from 'class-validator';

/**
 * Payload notifikasi webhook Midtrans (POST /payments/midtrans/notification).
 * Field inti untuk verifikasi signature: `order_id + status_code +
 * gross_amount + server_key` (SHA512). Lihat MidtransService.verifySignature.
 */
export class MidtransNotificationDto {
  @IsString()
  order_id!: string;

  @IsString()
  status_code!: string;

  @IsString()
  gross_amount!: string;

  @IsString()
  signature_key!: string;

  @IsString()
  transaction_status!: string;

  @IsOptional()
  @IsString()
  fraud_status?: string;

  @IsOptional()
  @IsString()
  payment_type?: string;
}
