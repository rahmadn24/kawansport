import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { RefreshToken } from './auth/refresh-token.entity';
import { Booking } from './bookings/booking.entity';
import { BookingsModule } from './bookings/bookings.module';
import { ChangeRequest } from './change-requests/change-request.entity';
import { ChangeRequestsModule } from './change-requests/change-requests.module';
import { ChatModule } from './chat/chat.module';
import { Conversation } from './chat/conversation.entity';
import { Message } from './chat/message.entity';
import { EventParticipant } from './events/event-participant.entity';
import { SportEvent } from './events/event.entity';
import { EventsModule } from './events/events.module';
import { HealthController } from './health/health.controller';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { DeviceToken } from './notifications/device-token.entity';
import { NotificationsModule } from './notifications/notifications.module';import { Cart, CartItem } from './marketplace/cart.entity';
import { Product } from './marketplace/product.entity';
import { Seller } from './marketplace/seller.entity';
import {
  ShopOrder,
  ShopOrderGroup,
  ShopOrderItem,
} from './marketplace/shop-order.entity';
import { User } from './users/user.entity';
import { UsersModule } from './users/users.module';
import { Court } from './venues/court.entity';
import { Rating } from './ratings/rating.entity';
import { Review } from './ratings/review.entity';
import { SlotClaim } from './venues/slot-claim.entity';
import { Venue } from './venues/venue.entity';
import { VenuesModule } from './venues/venues.module';
import { RatingsModule } from './ratings/ratings.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    ScheduleModule.forRoot(),
    // Postgres untuk dev/prod (DATABASE_URL). Untuk e2e tanpa Postgres,
    // set DB_DRIVER=sqljs agar memakai in-memory sql.js.
    TypeOrmModule.forRoot({
      ...(process.env.DB_DRIVER === 'sqljs'
        ? {
            type: 'sqljs' as const,
            entities: [User, RefreshToken, SportEvent, EventParticipant, Conversation, Message, Venue, Court, SlotClaim, Booking, Seller, Product, Cart, CartItem, ShopOrder, ShopOrderGroup, ShopOrderItem, ChangeRequest, Rating, Review, DeviceToken],
            synchronize: true,
          }
        : {
            type: 'postgres' as const,
            url: process.env.DATABASE_URL,
            entities: [User, RefreshToken, SportEvent, EventParticipant, Conversation, Message, Venue, Court, SlotClaim, Booking, Seller, Product, Cart, CartItem, ShopOrder, ShopOrderGroup, ShopOrderItem, ChangeRequest, Rating, Review, DeviceToken],
            synchronize: process.env.TYPEORM_SYNC !== 'false',
          }),
    }),
    UsersModule,
    AuthModule,
    AdminModule,
    ChangeRequestsModule,
    EventsModule,
    VenuesModule,
    RatingsModule,
    BookingsModule,
    ChatModule,
    MarketplaceModule,
    NotificationsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
