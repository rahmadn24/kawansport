import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChangeRequestsModule } from '../change-requests/change-requests.module';
import { UsersModule } from '../users/users.module';
import { Court } from './court.entity';
import { SlotClaim } from './slot-claim.entity';
import { SlotsController } from './slots.controller';
import { SlotsService } from './slots.service';
import { Venue } from './venue.entity';
import { VenuesController } from './venues.controller';
import { VenuesService } from './venues.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Venue, Court, SlotClaim]),
    UsersModule,
    ChangeRequestsModule,
  ],
  controllers: [VenuesController, SlotsController],
  providers: [VenuesService, SlotsService],
  exports: [VenuesService, SlotsService],
})
export class VenuesModule {}
