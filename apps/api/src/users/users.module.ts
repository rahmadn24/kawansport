import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../bookings/booking.entity';
import { Conversation } from '../chat/conversation.entity';
import { EloHistory } from '../elo/elo-history.entity';
import { EloRating } from '../elo/elo-rating.entity';
import { MatchResult } from '../elo/match-result.entity';
import { EventParticipant } from '../events/event-participant.entity';
import { SportEvent } from '../events/event.entity';
import { Court } from '../venues/court.entity';
import { User } from './user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  // Entitas lintas modul HANYA untuk baca agregat ST-07 (stats/circle) —
  // tanpa import modul pemiliknya (hindari siklus modul).
  // EloRating HANYA untuk baca filter/badge EL-01 di searchUsers
  // (tanpa import EloModule — EloModule justru mengimpor UsersModule).
  // EloHistory HANYA untuk tulis baris decay EL-05 (`kind='decay'`,
  // `matchId` null) saat decay oportunistik diterapkan di search —
  // rumus + persist milik EloService dipakai ulang via helper murni
  // `decayPeriodsDue` (tanpa import EloModule).
  // MatchResult HANYA untuk baca rekor winRate EL-05 + lawan match di
  // circle (tanpa import EloModule — pola lintas-entitas yang sama).
  imports: [
    TypeOrmModule.forFeature([
      User,
      SportEvent,
      EventParticipant,
      Booking,
      Court,
      Conversation,
      EloRating,
      EloHistory,
      MatchResult,
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}
