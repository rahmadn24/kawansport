import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { MatchResult } from '../elo/match-result.entity';
import { UsersModule } from '../users/users.module';
import { Venue } from '../venues/venue.entity';
import { Tournament } from './tournament.entity';
import { TournamentsController } from './tournaments.controller';
import { TournamentsService } from './tournaments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tournament, MatchResult, Venue]),
    AuthModule,
    UsersModule,
  ],
  controllers: [TournamentsController],
  providers: [TournamentsService],
  exports: [TournamentsService],
})
export class TournamentsModule {}
