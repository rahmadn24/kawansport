import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { BadgesModule } from '../badges/badges.module';
import { Tournament } from '../tournaments/tournament.entity';
import { UsersModule } from '../users/users.module';
import { Venue } from '../venues/venue.entity';
import { EloController } from './elo.controller';
import { EloHistory } from './elo-history.entity';
import { EloRating } from './elo-rating.entity';
import { EloService } from './elo.service';
import { MatchResult } from './match-result.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MatchResult,
      EloRating,
      EloHistory,
      Venue,
      Tournament,
    ]),
    AuthModule,
    UsersModule,
    BadgesModule,
  ],
  controllers: [EloController],
  providers: [EloService],
  exports: [EloService],
})
export class EloModule {}
