import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';import type { Request, Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AccessPayload } from '../auth/jwt-auth.guard';
import type { RequestUser } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { isPendingChange } from '../change-requests/change-requests.service';
import type { UserRole } from '../users/user.entity';
import { CreateCourtDto } from './dto/create-court.dto';
import { CreateVenueDocumentDto } from './dto/create-venue-document.dto';
import { CreateVenueDto } from './dto/create-venue.dto';
import { ListVenuesDto } from './dto/list-venues.dto';
import { MineVenuesQueryDto } from './dto/mine-venues-query.dto';
import { RejectVenueDto } from './dto/reject-venue.dto';
import { UpdateCourtDto } from './dto/update-court.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { VenuePhotoDto } from './dto/venue-photo.dto';
import { VenueStatsQueryDto } from './dto/venue-stats-query.dto';
import { VerifyVenueDocumentDto } from './dto/verify-venue-document.dto';
import { VenueStatsService } from './venue-stats.service';
import { VenuesService } from './venues.service';

@Controller('venues')
export class VenuesController {
  constructor(
    private readonly venues: VenuesService,
    private readonly stats: VenueStatsService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Buat venue (BK-01). Owner otomatis = user JWT.
   * venue_owner langsung `pending`; super_admin mulai dari `draft`.
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('venue_owner', 'super_admin')
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateVenueDto) {
    return this.venues.create(user, dto);
  }

  /**
   * Daftar venue PUBLIK — hanya yang `approved`.
   * Filter sport + lingkaran geo (sort jarak), pagination + meta.
   */
  @Get()
  list(@Query() query: ListVenuesDto) {
    return this.venues.list(query);
  }

  /**
   * Daftar venue milik sendiri (API-W05, untuk CMS owner — ganti form
   * venueId manual). WAJIB sebelum rute `:id` agar `mine` tidak
   * ditangkap sebagai UUID.
   */
  @Get('mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('venue_owner', 'super_admin')
  mine(@CurrentUser() user: RequestUser, @Query() query: MineVenuesQueryDto) {
    return this.stats.listMine(user, query.all);
  }

  /**
   * Analitik satu venue milik sendiri (API-W05). Lintas owner → 403
   * (cek DB `ownerId == user.id` di service, super_admin lolos).
   */
  @Get(':id/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('venue_owner', 'super_admin')
  venueStats(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: RequestUser,
    @Query() query: VenueStatsQueryDto,
  ) {
    return this.stats.getStats(id, user, query.date);
  }

  /**
   * Detail venue. Publik bila `approved`; non-approved hanya terlihat
   * oleh owner-nya / super_admin (selain itu 404 agar tidak bocor).
   * Auth opsional: tanpa token hanya approved yang terlihat.
   */
  @Get(':id')
  detail(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request,
  ) {
    return this.venues.detail(id, this.extractOptionalActor(req));
  }

  /**
   * Ubah venue — hanya owner venue atau super_admin (403 bila bukan).
   * AD-02: edit field sensitif atas venue approved oleh owner → 202
   * change request (publik tetap data lama); admin / non-approved → 200.
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateVenueDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.venues.update(id, user, dto);
    if (isPendingChange(result)) res.status(202);
    return result;
  }

  /** Submit draft -> pending (owner venue / super_admin). */
  @Post(':id/submit')
  @UseGuards(JwtAuthGuard)
  submit(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.venues.submit(id, user);
  }

  /** Approve pending -> approved (khusus super_admin). */
  @Post(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  approve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.venues.approve(id, user.id);
  }

  /** Reject pending -> rejected + alasan (khusus super_admin). */
  @Post(':id/reject')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  reject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: RejectVenueDto,
  ) {
    return this.venues.reject(id, dto.reason, user.id);
  }

  /** Tambah court ke venue (owner venue / super_admin). */
  @Post(':id/courts')
  @UseGuards(JwtAuthGuard)
  createCourt(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateCourtDto,
  ) {
    return this.venues.createCourt(id, user, dto);
  }

  /**
   * Tambah satu foto venue (ST-01, owner / super_admin).
   * Langsung disimpan tanpa change request (maks 5, URL /uploads/ atau
   * https); venue tetap harus `approved` agar tampil publik.
   */
  @Post(':id/photos')
  @UseGuards(JwtAuthGuard)
  addPhoto(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: VenuePhotoDto,
  ) {
    return this.venues.addPhoto(id, user, dto.url);
  }

  /**
   * Hapus satu foto venue (ST-01, owner / super_admin).
   * Langsung disimpan tanpa change request; foto tidak ada → 404.
   */
  @Delete(':id/photos')
  @UseGuards(JwtAuthGuard)
  removePhoto(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: VenuePhotoDto,
  ) {
    return this.venues.removePhoto(id, user, dto.url);
  }

  /**
   * Ubah court (owner venue / super_admin).
   * AD-02: edit sensitif atas court venue-approved oleh owner → 202 CR.
   */
  @Patch(':id/courts/:courtId')
  @UseGuards(JwtAuthGuard)
  async updateCourt(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('courtId', new ParseUUIDPipe()) courtId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateCourtDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.venues.updateCourt(id, courtId, user, dto);
    if (isPendingChange(result)) res.status(202);
    return result;
  }

  /**
   * Tambah dokumen legalitas venue (API-W01, owner venue / super_admin).
   * Lintas owner → 403 (cek DB di service, pola API-W05).
   * URL pola ST-01 (`/uploads/` atau `https`); status awal `pending`.
   */
  @Post(':id/documents')
  @UseGuards(JwtAuthGuard)
  addDocument(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateVenueDocumentDto,
  ) {
    return this.venues.addDocument(id, user, dto);
  }

  /**
   * Hapus dokumen legalitas venue (API-W01, owner venue / super_admin).
   * Lintas owner → 403; dokumen tak ada / milik venue lain → 404.
   */
  @Delete(':id/documents/:docId')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async removeDocument(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('docId', new ParseUUIDPipe()) docId: string,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    await this.venues.removeDocument(id, docId, user);
  }

  /**
   * Verifikasi dokumen legalitas (API-W01, khusus super_admin).
   * Body `{ status: verified|rejected, note? }`; status lain → 400.
   */
  @Post(':id/documents/:docId/verify')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  verifyDocument(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('docId', new ParseUUIDPipe()) docId: string,
    @Body() dto: VerifyVenueDocumentDto,
  ) {
    return this.venues.verifyDocument(id, docId, dto);
  }

  /**
   * Aktor opsional untuk endpoint publik: bila ada Bearer token valid,
   * kembalikan { id, role } agar owner/admin bisa melihat venue miliknya
   * yang belum approved; tanpa token / token invalid → null (hanya
   * approved yang terlihat). Tidak pernah throw.
   */
  private extractOptionalActor(req: Request): { id: string; role: UserRole } | null {
    const header: string = req.headers?.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) return null;
    try {
      const payload = this.jwt.verify<AccessPayload>(token);
      if (!payload?.sub) return null;
      return { id: payload.sub, role: payload.role ?? 'user' };
    } catch {
      return null;
    }
  }
}
