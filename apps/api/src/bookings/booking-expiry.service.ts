import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BookingsService } from './bookings.service';

/**
 * Job expiry booking BK-03: pending berumur > 30 mnt → expired + slot released.
 * Jalan tiap 5 menit; cek oportunistik di BookingsService (saat baca/tulis)
 * menutup jeda antar-tick cron.
 */
@Injectable()
export class BookingExpiryService {
  private readonly logger = new Logger(BookingExpiryService.name);

  constructor(private readonly bookings: BookingsService) {}

  @Cron('*/5 * * * *')
  async expireStaleBookings(): Promise<void> {
    const n = await this.bookings.expireDueBookings();
    if (n > 0) {
      this.logger.log(`Expired ${n} stale pending booking(s)`);
    }
  }
}
