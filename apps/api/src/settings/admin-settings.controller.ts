import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';
import { SettingsService } from './settings.service';

/**
 * Pengaturan platform (API-W03, khusus super_admin — pola guard sama
 * dengan VouchersController / AdminController).
 * - GET /admin/settings: semua kunci + nilai ter-parse.
 * - PUT /admin/settings: body Record key->value ter-allowlist.
 */
@Controller('admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
export class AdminSettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** Daftar semua pengaturan platform + nilai ter-parse. */
  @Get()
  list() {
    return this.settings.list();
  }

  /**
   * Ubah pengaturan (parsial). Kunci asing -> 400, tipe salah -> 400.
   * Body diketik DTO agar class-validator global ikut berjalan; validasi
   * allowlist + aturan per kunci ditegakkan di service (sumber kebenaran).
   */
  @Put()
  update(@Body() dto: UpdatePlatformSettingsDto) {
    return this.settings.update(dto as unknown as Record<string, unknown>);
  }
}
