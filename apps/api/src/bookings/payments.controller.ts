import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { MidtransNotificationDto } from './dto/midtrans-notification.dto';

/**
 * Webhook pembayaran Midtrans (BK-03 + MP-02).
 * PUBLIK (tanpa JWT) — keaslian dijamin verifikasi signature SHA512 di
 * `BookingsService.handleNotification` (403 bila invalid). Routing kanal via
 * prefix `order_id`: "MP-" → order marketplace, selain itu → booking.
 * Idempotent via status guard: hanya `pending` yang bisa berubah.
 */
@Controller('payments')
export class PaymentsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post('midtrans/notification')
  @HttpCode(200)
  notification(@Body() dto: MidtransNotificationDto) {
    return this.bookings.handleNotification(dto);
  }
}
