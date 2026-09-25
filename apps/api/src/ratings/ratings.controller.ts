import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateRatingDto } from './dto/create-rating.dto';
import { ListRatingsDto } from './dto/list-ratings.dto';
import { UpdateRatingDto } from './dto/update-rating.dto';
import {
  RatingsService,
  RatingItem,
  PaginatedRatings,
  type RatingViewer,
} from './ratings.service';

@Controller('ratings')
export class RatingsController {
  constructor(
    private readonly ratings: RatingsService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Viewer opsional untuk endpoint publik (ST-06): bila ada Bearer valid,
   * kembalikan { id, role } agar review anonim tetap terlihat asli bagi
   * owner + admin; selain itu null (publik tersamar). Token invalid/absen
   * TIDAK menggagalkan request (endpoint tetap publik).
   */
  private async resolveViewer(req: Request): Promise<RatingViewer> {
    const header: string = req.headers?.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) return null;
    try {
      const payload = await this.jwt.verifyAsync<{
        sub: string;
        role?: string;
      }>(token);
      if (!payload?.sub) return null;
      return { id: payload.sub, role: payload.role ?? 'user' };
    } catch {
      return null;
    }
  }

  /**
   * POST /api/ratings — Buat rating + review (auth required).
   * Body: { venueId, courtId?, score, comment?, photos?, aspects?, tags?, isAnonymous? }
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateRatingDto,
  ): Promise<RatingItem> {
    return this.ratings.create(user, dto);
  }

  /**
   * GET /api/venues/:venueId/ratings — List rating venue dengan pagination.
   * Query: page, limit, sortBy (latest/highest/lowest)
   * Publik; kirim Bearer opsional agar review anonim milik sendiri/admin
   * terlihat asli (ST-06).
   */
  @Get('venues/:venueId/ratings')
  async listByVenue(
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Query() query: ListRatingsDto,
    @Req() req: Request,
  ): Promise<PaginatedRatings> {
    return this.ratings.listByVenue(venueId, query, await this.resolveViewer(req));
  }

  /**
   * GET /api/courts/:courtId/ratings — List rating court dengan pagination.
   * Query: page, limit, sortBy (latest/highest/lowest)
   * Publik; Bearer opsional (ST-06, sama seperti list venue).
   */
  @Get('courts/:courtId/ratings')
  async listByCourt(
    @Param('courtId', new ParseUUIDPipe()) courtId: string,
    @Query() query: ListRatingsDto,
    @Req() req: Request,
  ): Promise<PaginatedRatings> {
    return this.ratings.listByCourt(courtId, query, await this.resolveViewer(req));
  }

  /**
   * GET /api/ratings/:id — Detail rating + review.
   * Publik; Bearer opsional (ST-06, sama seperti list).
   */
  @Get(':id')
  async detail(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request,
  ): Promise<RatingItem> {
    return this.ratings.detail(id, await this.resolveViewer(req));
  }

  /**
   * PUT /api/ratings/:id — Update rating/review (auth, owner only).
   * Body: { score?, comment?, photos?, aspects?, tags?, isAnonymous? }
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateRatingDto,
  ): Promise<RatingItem> {
    return this.ratings.update(id, user, dto);
  }

  /**
   * DELETE /api/ratings/:id — Hapus rating (auth, owner/admin).
   * Hard delete.
   */
  @Delete(':id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async delete(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    await this.ratings.delete(id, user);
  }
}