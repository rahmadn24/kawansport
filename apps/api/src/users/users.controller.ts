import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SearchUsersDto } from './dto/search-users.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /**
   * Cari partner sparing (SM-06): exclude diri sendiri, filter sport overlap
   * + skill, lingkaran geo ST_DWithin + sort jarak ASC, pagination + meta.
   */
  @Get('search')
  search(@CurrentUser() user: { id: string }, @Query() query: SearchUsersDto) {
    return this.users.searchUsers(user.id, query);
  }

  /**
   * Lingkaran mabar milik sendiri (ST-07): partner chat + co-participants
   * event, dedupe, maks 50 — definisi V1 di UsersService.getCircle.
   * Ditaruh sebelum route `:id/*` agar tidak tertelan param.
   */
  @Get('me/circle')
  myCircle(@CurrentUser() user: { id: string }) {
    return this.users.getCircle(user.id);
  }

  /**
   * Statistik profil user mana pun (ST-07) — boleh dibaca user login apa pun.
   * Angka dari data REAL (host/join event, booking paid, gabungan cabor);
   * TANPA win-rate (butuh EL-00, TODO-EL-00).
   */
  @Get(':id/stats')
  stats(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.users.getStats(id);
  }

  /**
   * Tandai user terverifikasi (ST-07, khusus super_admin, idempotent).
   * JwtAuthGuard sudah di level class — di sini cukup tambah RolesGuard.
   */
  @Post(':id/verify')
  @HttpCode(200)
  @UseGuards(RolesGuard)
  @Roles('super_admin')
  verify(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.users.verify(id);
  }
}
