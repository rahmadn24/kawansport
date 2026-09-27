import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { RequestUser } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ListMatchesDto } from './dto/list-matches.dto';
import { CreateMatchDto } from './dto/create-match.dto';
import { ResolveDisputedMatchDto } from './dto/resolve-disputed-match.dto';
import { SetMatchScoreDto } from './dto/set-match-score.dto';
import { WalkoverDto } from './dto/walkover.dto';
import { VenueLeaderboardQueryDto } from './dto/venue-leaderboard-query.dto';
import { EloService } from './elo.service';

/**
 * Fondasi ELO + hasil match terkonfirmasi (EL-00).
 * Semua endpoint butuh JWT kecuali GET /users/:id/elo (publik).
 */
@Controller()
export class EloController {
  constructor(private readonly elo: EloService) {}

  /** POST /matches — catat hasil (creator auto-confirmer bila termasuk tim). */
  @Post('matches')
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateMatchDto) {
    return this.elo.create(user, dto);
  }

  /** GET /matches/me — matchku (?status=pending|confirmed|disputed|cancelled). */
  @Get('matches/me')
  @UseGuards(JwtAuthGuard)
  listMine(@CurrentUser() user: RequestUser, @Query() query: ListMatchesDto) {
    return this.elo.listMine(user, query.status);
  }

  /** GET /matches/:id — terlibat atau super_admin (else 403; tak ada → 404). */
  @Get('matches/:id')
  @UseGuards(JwtAuthGuard)
  detail(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.elo.detail(user, id);
  }

  /** POST /matches/:id/confirm — konfirmasi pihak timku (dua pihak → confirmed + ELO). */
  @Post('matches/:id/confirm')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  confirm(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.elo.confirm(user, id);
  }

  /** POST /matches/:id/cancel — creator/super_admin, hanya bila pending. */
  @Post('matches/:id/cancel')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  cancel(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.elo.cancel(user, id);
  }

  /**
   * POST /matches/:id/dispute — terlibat → disputed + freeze.
   * EL-05: admin menutup via POST /matches/:id/resolve-dispute.
   */
  @Post('matches/:id/dispute')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  dispute(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.elo.dispute(user, id);
  }

  /**
   * POST /matches/:id/resolve-dispute (EL-05, khusus super_admin) —
   * putusan atas match `disputed`: `confirm` (confirmed + ELO) atau
   * `cancel` (cancelled, walkover/batal). Non-disputed → 409.
   */
  @Post('matches/:id/resolve-dispute')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  resolveDisputed(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ResolveDisputedMatchDto,
  ) {
    return this.elo.resolveDisputed(id, dto.decision);
  }

  /**
   * POST /matches/:id/walkover (EL-05, khusus super_admin) — menang
   * tanpa tanding: skor WO 21-0 untuk `winnerSide`, `confirmed`, ELO
   * jalan normal. Dari pending/disputed; confirmed/cancelled → 409.
   * KEPUTUSAN: super_admin saja (bukan kesepakatan pemain).
   */
  @Post('matches/:id/walkover')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  walkover(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: WalkoverDto,
  ) {
    return this.elo.walkover(id, dto.winnerSide);
  }

  /** POST /matches/:id/score (EL-03) — koreksi skor bila pending + reset confirmedBy. */
  @Post('matches/:id/score')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  setScore(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SetMatchScoreDto,
  ) {
    return this.elo.setScore(user, id, dto.scoreA, dto.scoreB);
  }

  /** GET /elo/me — semua rating cabor milik sendiri. */
  @Get('elo/me')
  @UseGuards(JwtAuthGuard)
  myElo(@CurrentUser() user: RequestUser) {
    return this.elo.myElo(user);
  }

  /** GET /users/:id/elo — publik (tanpa auth). */
  @Get('users/:id/elo')
  publicElo(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.elo.userElo(id);
  }

  /**
   * GET /venues/:id/leaderboard — PUBLIK (tanpa auth). Agregasi
   * read-only match confirmed per venue (+ filter `?sport=`, `?limit=`).
   * Venue tak ada → 404; UUID invalid → 400.
   */
  @Get('venues/:id/leaderboard')
  venueLeaderboard(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: VenueLeaderboardQueryDto,
  ) {
    return this.elo.venueLeaderboard(id, query.sport, query.limit);
  }
}
