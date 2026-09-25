import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../bookings/booking.entity';
import { Conversation } from '../chat/conversation.entity';
import { EventParticipant } from '../events/event-participant.entity';
import { SportEvent } from '../events/event.entity';
import { Court } from '../venues/court.entity';
import { User } from './user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  // Entitas lintas modul HANYA untuk baca agregat ST-07 (stats/circle) —
  // tanpa import modul pemiliknya (hindari siklus modul).
  imports: [
    TypeOrmModule.forFeature([
      User,
      SportEvent,
      EventParticipant,
      Booking,
      Court,
      Conversation,
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}
