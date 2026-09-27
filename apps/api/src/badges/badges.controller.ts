import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { RequestUser } from '../auth/jwt-auth.guard';
import { BadgesService } from './badges.service';

/**
 * Badge digital juara turnamen (EL-04).
 * `GET /users/:id/badges` publik; `GET /badges/me` butuh JWT.
 * Ditaruh di controller sendiri (tanpa guard level-class) agar satu
 * route bisa publik — UsersController memakai guard level-class.
 */
@Controller()
export class BadgesController {
  constructor(private readonly badges: BadgesService) {}

  /** GET /badges/me — badge milik sendiri (auth). */
  @Get('badges/me')
  @UseGuards(JwtAuthGuard)
  myBadges(@CurrentUser() user: RequestUser) {
    return this.badges.listMine(user.id);
  }

  /** GET /users/:id/badges — PUBLIK (tanpa auth). User tak ada → 404. */
  @Get('users/:id/badges')
  userBadges(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.badges.listByUser(id);
  }
}
