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
import { EventPayment } from './events/event-payment.entity';
import { EventWaitlist } from './events/event-waitlist.entity';
import { SportEvent } from './events/event.entity';
import { EventsModule } from './events/events.module';
import { HealthController } from './health/health.controller';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { DeviceToken } from './notifications/device-token.entity';
import { NotificationsModule } from './notifications/notifications.module';import { NotificationHistory } from './notifications/notification-history.entity';
import { Invite } from './invites/invite.entity';
import { InvitesModule } from './invites/invites.module';import { Payout } from './payouts/payout.entity';
import { PayoutsModule } from './payouts/payouts.module';import { Dispute } from './disputes/dispute.entity';
import { DisputesModule } from './disputes/disputes.module';import { Cart, CartItem } from './marketplace/cart.entity';import { Product } from './marketplace/product.entity';
import { Seller } from './marketplace/seller.entity';
import {
  ShopOrder,
  ShopOrderGroup,
  ShopOrderItem,
} from './marketplace/shop-order.entity';
import { User } from './users/user.entity';
import { UsersModule } from './users/users.module';
import { PlatformSetting } from './settings/platform-setting.entity';
import { SettingsModule } from './settings/settings.module';
import { Court } from './venues/court.entity';
import { VenueDocument } from './venues/venue-document.entity';
import { Voucher, VoucherRedemption } from './vouchers/voucher.entity';
import { VouchersModule } from './vouchers/vouchers.module';
import { Rating } from './ratings/rating.entity';
import { Review } from './ratings/review.entity';
import { SlotBlock } from './venues/slot-block.entity';
import { SlotClaim } from './venues/slot-claim.entity';
import { Venue } from './venues/venue.entity';
import { VenuesModule } from './venues/venues.module';
import { RatingsModule } from './ratings/ratings.module';
import { UploadsModule } from './uploads/uploads.module';

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
            entities: [User, RefreshToken, SportEvent, EventParticipant, EventPayment, EventWaitlist, Conversation, Message, Venue, Court, VenueDocument, SlotClaim, SlotBlock, Booking, Seller, Product, Cart, CartItem, ShopOrder, ShopOrderGroup, ShopOrderItem, ChangeRequest, Rating, Review, DeviceToken, NotificationHistory, Invite, Voucher, VoucherRedemption, PlatformSetting, Dispute, Payout],
            synchronize: true,
          }
        : {
            type: 'postgres' as const,
            url: process.env.DATABASE_URL,
            entities: [User, RefreshToken, SportEvent, EventParticipant, EventPayment, EventWaitlist, Conversation, Message, Venue, Court, VenueDocument, SlotClaim, SlotBlock, Booking, Seller, Product, Cart, CartItem, ShopOrder, ShopOrderGroup, ShopOrderItem, ChangeRequest, Rating, Review, DeviceToken, NotificationHistory, Invite, Voucher, VoucherRedemption, PlatformSetting, Dispute, Payout],
            synchronize: process.env.TYPEORM_SYNC !== 'false',
          }),
    }),
    UsersModule,
    AuthModule,
    AdminModule,
    UploadsModule,
    ChangeRequestsModule,
    EventsModule,
    VenuesModule,
    RatingsModule,
    BookingsModule,
    ChatModule,
    MarketplaceModule,
    NotificationsModule,
    InvitesModule,
    VouchersModule,
    SettingsModule,
    DisputesModule,
    PayoutsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
