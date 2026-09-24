import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsModule } from '../bookings/bookings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { EventParticipant } from './event-participant.entity';
import { EventPayment } from './event-payment.entity';
import { EventWaitlist } from './event-waitlist.entity';
import { SportEvent } from './event.entity';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SportEvent,
      EventParticipant,
      EventPayment,
      EventWaitlist,
    ]),
    UsersModule,
    BookingsModule,
    NotificationsModule,
  ],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
