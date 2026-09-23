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
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateRatingDto } from './dto/create-rating.dto';
import { ListRatingsDto } from './dto/list-ratings.dto';
import { UpdateRatingDto } from './dto/update-rating.dto';
import { RatingsService, RatingItem, PaginatedRatings } from './ratings.service';

@Controller('ratings')
export class RatingsController {
  constructor(private readonly ratings: RatingsService) {}

  /**
   * POST /api/ratings — Buat rating + review (auth required).
   * Body: { venueId, courtId?, score, comment? }
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
   */
  @Get('venues/:venueId/ratings')
  async listByVenue(
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Query() query: ListRatingsDto,
  ): Promise<PaginatedRatings> {
    return this.ratings.listByVenue(venueId, query);
  }

  /**
   * GET /api/courts/:courtId/ratings — List rating court dengan pagination.
   * Query: page, limit, sortBy (latest/highest/lowest)
   */
  @Get('courts/:courtId/ratings')
  async listByCourt(
    @Param('courtId', new ParseUUIDPipe()) courtId: string,
    @Query() query: ListRatingsDto,
  ): Promise<PaginatedRatings> {
    return this.ratings.listByCourt(courtId, query);
  }

  /**
   * GET /api/ratings/:id — Detail rating + review.
   */
  @Get(':id')
  async detail(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<RatingItem> {
    return this.ratings.detail(id);
  }

  /**
   * PUT /api/ratings/:id — Update rating/review (auth, owner only).
   * Body: { score?, comment?, photos? }
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