import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard, RequestUser } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminStatsService } from './admin-stats.service';
import { AdminStatsQueryDto } from './dto/admin-stats.dto';

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
  async getStats(@Query() query: AdminStatsQueryDto) {
    const fromDate = query.from ? new Date(query.from) : undefined;
    const toDate = query.to ? new Date(query.to) : undefined;
    return this.stats.getStats(fromDate, toDate);
  }
}
