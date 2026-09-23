import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChangeRequestsModule } from '../change-requests/change-requests.module';
import { Booking } from '../bookings/booking.entity';
import { Rating } from '../ratings/rating.entity';
import { SettingsModule } from '../settings/settings.module';
import { UsersModule } from '../users/users.module';
import { Court } from './court.entity';
import { SlotBlock } from './slot-block.entity';
import { SlotClaim } from './slot-claim.entity';
import { SlotsController } from './slots.controller';
import { SlotsService } from './slots.service';
import { Venue } from './venue.entity';
import { VenueDocument } from './venue-document.entity';
import { VenueStatsService } from './venue-stats.service';
import { VenuesController } from './venues.controller';
import { VenuesService } from './venues.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Venue, Court, SlotClaim, SlotBlock, Booking, Rating, VenueDocument]),
    UsersModule,
    ChangeRequestsModule,
    SettingsModule,
  ],
  controllers: [VenuesController, SlotsController],
  providers: [VenuesService, SlotsService, VenueStatsService],
  exports: [VenuesService, SlotsService, VenueStatsService],
})
export class VenuesModule {}
