import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Booking } from '../bookings/booking.entity';
import { Seller } from '../marketplace/seller.entity';
import { ShopOrderGroup } from '../marketplace/shop-order.entity';
import { SettingsModule } from '../settings/settings.module';
import { UsersModule } from '../users/users.module';
import { Court } from '../venues/court.entity';
import { Venue } from '../venues/venue.entity';
import { Payout } from './payout.entity';
import { PayoutsController } from './payouts.controller';
import { PayoutsService } from './payouts.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Payout,
      Venue,
      Court,
      Booking,
      Seller,
      ShopOrderGroup,
    ]),
    AuthModule,
    UsersModule,
    SettingsModule,
  ],
  controllers: [PayoutsController],
  providers: [PayoutsService],
  exports: [PayoutsService],
})
export class PayoutsModule {}
