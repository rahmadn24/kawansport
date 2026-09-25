import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventParticipant } from '../events/event-participant.entity';
import { SportEvent } from '../events/event.entity';
import { Court } from '../venues/court.entity';
import { RentalItem } from '../venues/rental-item.entity';
import { Venue } from '../venues/venue.entity';
import { VenuesModule } from '../venues/venues.module';
import { VouchersModule } from '../vouchers/vouchers.module';
import { SettingsModule } from '../settings/settings.module';
import { BookingExpiryService } from './booking-expiry.service';
import { Booking } from './booking.entity';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { MidtransService } from './midtrans.service';
import { PaymentsController } from './payments.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, Court, Venue, RentalItem, SportEvent, EventParticipant]),
    VenuesModule,
    VouchersModule,
    SettingsModule,
  ],
  controllers: [BookingsController, PaymentsController],
  providers: [BookingsService, MidtransService, BookingExpiryService],
  exports: [BookingsService, MidtransService],
})
export class BookingsModule {}
