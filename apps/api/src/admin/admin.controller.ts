import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard, RequestUser } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminStatsService } from './admin-stats.service';

/**
 * Admin endpoints: ping (AD-01) + stats (AD-03).
 * Hanya `super_admin` yang boleh mengakses.
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly stats: AdminStatsService) {}

  @Get('ping')
  @Roles('super_admin')
  ping(@CurrentUser() user: RequestUser) {
    return { ok: true, role: user.role, userId: user.id };
  }

  @Get('stats')
  @Roles('super_admin')
  async getStats(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    return this.stats.getStats(fromDate, toDate);
  }
}
