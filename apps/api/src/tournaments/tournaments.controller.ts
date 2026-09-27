import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { RequestUser } from '../auth/jwt-auth.guard';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { TournamentsService } from './tournaments.service';

/**
 * Turnamen mini 1v1 (EL-03). Skor fixture + konfirmasi + ELO memakai ulang
 * alur EL-00 (`POST /matches/:id/score`, `POST /matches/:id/confirm`).
 */
@Controller('tournaments')
export class TournamentsController {
  constructor(private readonly tournaments: TournamentsService) {}

  /** POST /tournaments — buat turnamen (status `draft`). */
  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateTournamentDto) {
    return this.tournaments.create(user, dto);
  }

  /** GET /tournaments/me — turnamenku (peserta/creator). */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  listMine(@CurrentUser() user: RequestUser) {
    return this.tournaments.listMine(user);
  }

  /** GET /tournaments/:id/standing — klasemen real-time (EL-04, guard = detail). */
  @Get(':id/standing')
  @UseGuards(JwtAuthGuard)
  standing(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.tournaments.standing(user, id);
  }

  /** GET /tournaments/:id — terlibat/creator atau super_admin + fixture. */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  detail(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.tournaments.detail(user, id);
  }

  /** POST /tournaments/:id/generate — creator/super_admin, draft → ongoing. */
  @Post(':id/generate')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  generate(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.tournaments.generate(user, id);
  }

  /** POST /tournaments/:id/cancel — creator/super_admin, selama belum done. */
  @Post(':id/cancel')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  cancel(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.tournaments.cancel(user, id);
  }
}
