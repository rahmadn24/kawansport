import {
  Body,
  Controller,
  HttpCode,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { MidtransService } from './midtrans.service';
import { MidtransNotificationDto } from './dto/midtrans-notification.dto';

/**
 * Webhook pembayaran Midtrans (BK-03 + MP-02).
 * PUBLIK (tanpa JWT) — keaslian dijamin verifikasi signature SHA512 di
 * `BookingsService.handleNotification` (403 bila invalid). Routing kanal via
 * prefix `order_id`: "MP-" → order marketplace, selain itu → booking.
 * Idempotent via status guard: hanya `pending` yang bisa berubah.
 *
 * Fail-closed (SEC-01 Critical): stub tanpa server key dilarang di
 * production — webhook ditolak 503 agar tidak ada paid palsu. Dev/test
 * (NODE_ENV!=production) tetap stub agar E2E hijau.
 */
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly midtrans: MidtransService,
  ) {}

  @Post('midtrans/notification')
  @HttpCode(200)
  notification(@Body() dto: MidtransNotificationDto) {
    if (
      process.env.NODE_ENV === 'production' &&
      this.midtrans.isStubMode()
    ) {
      throw new ServiceUnavailableException(
        'Payment webhook unavailable: MIDTRANS_SERVER_KEY not configured',
      );
    }
    return this.bookings.handleNotification(dto);
  }
}
