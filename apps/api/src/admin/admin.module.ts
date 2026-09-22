import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BookingsModule } from '../bookings/bookings.module';
import { MarketplaceModule } from '../marketplace/marketplace.module';
import { UsersModule } from '../users/users.module';
import { VenuesModule } from '../venues/venues.module';
import { AdminListsController } from './admin-lists.controller';
import { AdminController } from './admin.controller';
import { AdminStatsService } from './admin-stats.service';

@Module({
  imports: [
    UsersModule,
    AuthModule,
    VenuesModule,
    MarketplaceModule,
    BookingsModule,
  ],
  controllers: [AdminController, AdminListsController],
  providers: [AdminStatsService],
})
export class AdminModule {}
