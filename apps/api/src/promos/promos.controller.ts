import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AccessPayload, RequestUser } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { UserRole } from '../users/user.entity';
import { CreatePromoDto } from './dto/create-promo.dto';
import { ListPromosDto } from './dto/list-promos.dto';
import { UpdatePromoDto } from './dto/update-promo.dto';
import { PromosService } from './promos.service';

@Controller('promos')
export class PromosController {
  constructor(
    private readonly promos: PromosService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Buat banner promo (ST-09, khusus super_admin).
   * `imageUrl` mengikuti aturan ST-01 (`/uploads/` atau `https`).
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  create(@Body() dto: CreatePromoDto) {
    return this.promos.create(dto);
  }

  /**
   * Daftar banner (ST-09).
   * - Publik (tanpa token): hanya banner `active` dalam periode tayang.
   * - `?all=true`: khusus super_admin (butuh Bearer admin) — semua banner
   *   untuk CMS kelola. Tanpa token → 401; non-admin → 403.
   */
  @Get()
  list(@Query() query: ListPromosDto, @Req() req: Request) {
    if (query.all) {
      const actor = this.requireActor(req);
      if (actor.role !== 'super_admin') {
        throw new ForbiddenException('Forbidden: super_admin only');
      }
      return this.promos.list(true);
    }
    return this.promos.list(false);
  }

  /**
   * Ubah banner — khusus super_admin. Parsial; `active: false` =
   * nonaktifkan (banner hilang dari feed publik). Periode divalidasi
   * ulang (startsAt <= endsAt).
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() _user: RequestUser,
    @Body() dto: UpdatePromoDto,
  ) {
    return this.promos.update(id, dto);
  }

  /** Hapus banner permanen — khusus super_admin. */
  @Delete(':id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  async remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.promos.remove(id);
  }

  /**
   * Aktor wajib untuk `?all=true`: tanpa token → 401; token invalid → 401.
   * Tidak pernah mengembalikan null (beda dari endpoint publik opsional).
   */
  private requireActor(req: Request): { id: string; role: UserRole } {
    const header: string = req.headers?.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing bearer token');
    }
    try {
      const payload = this.jwt.verify<AccessPayload>(token);
      if (!payload?.sub) throw new UnauthorizedException('Invalid token');
      return { id: payload.sub, role: payload.role ?? 'user' };
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('Invalid token');
    }
  }
}
