import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard, RequestUser } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminActivityService } from './admin-activity.service';
import { AdminStatsService } from './admin-stats.service';
import { AdminActivityQueryDto } from './dto/admin-activity.dto';
import { AdminStatsQueryDto } from './dto/admin-stats.dto';

/**
 * Admin endpoints: ping (AD-01) + stats (AD-03) + activity feed (API-W04).
 * Hanya `super_admin` yang boleh mengakses.
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(
    private readonly stats: AdminStatsService,
    private readonly activity: AdminActivityService,
  ) {}

  @Get('ping')
  @Roles('super_admin')
  ping(@CurrentUser() user: RequestUser) {
    return { ok: true, role: user.role, userId: user.id };
  }

  @Get('stats')
  @Roles('super_admin')
  async getStats(@Query() query: AdminStatsQueryDto) {
    const fromDate = query.from ? new Date(query.from) : undefined;
    const toDate = query.to ? new Date(query.to) : undefined;
    return this.stats.getStats(fromDate, toDate);
  }

  /**
   * GET /admin/activity (API-W04) — feed agregasi read-only lintas tabel,
   * urut waktu DESC. Query `limit?` (default 20, maks 100).
   */
  @Get('activity')
  @Roles('super_admin')
  async getActivity(@Query() query: AdminActivityQueryDto) {
    return this.activity.getActivity(query.limit ?? 20);
  }
}
