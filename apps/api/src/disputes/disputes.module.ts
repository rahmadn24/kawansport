import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { MatchResult } from '../elo/match-result.entity';
import { UsersModule } from '../users/users.module';
import { Dispute } from './dispute.entity';
import { DisputesController } from './disputes.controller';
import { DisputesService } from './disputes.service';

@Module({
  // MatchResult HANYA untuk validasi + auto-dispute target `match` (EL-05)
  // — tanpa import EloModule (hindari siklus modul; logika ELO tetap di
  // EloService via endpoint match terpisah).
  imports: [
    TypeOrmModule.forFeature([Dispute, MatchResult]),
    AuthModule,
    UsersModule,
  ],
  controllers: [DisputesController],
  providers: [DisputesService],
  exports: [DisputesService],
})
export class DisputesModule {}
