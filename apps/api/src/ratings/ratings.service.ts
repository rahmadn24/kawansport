import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { assertOwnerOrAdmin, type ActorInput } from '../auth/ownership';
import { Court } from '../venues/court.entity';
import { Venue } from '../venues/venue.entity';
import { CreateRatingDto } from './dto/create-rating.dto';
import { ListRatingsDto, RatingSortBy } from './dto/list-ratings.dto';
import { UpdateRatingDto } from './dto/update-rating.dto';
import { Rating } from './rating.entity';
import { Review } from './review.entity';

export interface RatingItem {
  id: string;
  userId: string;
  user: { id: string; email: string; displayName: string | null; avatarUrl: string | null };
  venueId: string;
  courtId: string | null;
  score: number;
  review: { id: string; comment: string | null; createdAt: Date; updatedAt: Date } | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedRatings {
  data: RatingItem[];
  meta: { page: number; limit: number; total: number };
}

@Injectable()
export class RatingsService {
  constructor(
    @InjectRepository(Rating)
    private readonly ratings: Repository<Rating>,
    @InjectRepository(Review)
    private readonly reviews: Repository<Review>,
    @InjectRepository(Venue)
    private readonly venues: Repository<Venue>,
    @InjectRepository(Court)
    private readonly courts: Repository<Court>,
  ) {}

  /** POST /api/ratings — buat rating + review (auth required). */
  async create(actor: ActorInput, dto: CreateRatingDto): Promise<RatingItem> {
    // Validasi venue exists
    const venue = await this.venues.findOne({ where: { id: dto.venueId } });
    if (!venue) throw new NotFoundException('Venue not found');

    // Validasi court exists (jika dikirim) dan milik venue yang sama
    if (dto.courtId) {
      const court = await this.courts.findOne({ where: { id: dto.courtId } });
      if (!court) throw new NotFoundException('Court not found');
      if (court.venueId !== dto.venueId) {
        throw new BadRequestException('Court does not belong to this venue');
      }
    }

    // Cek apakah user sudah rating venue/court ini (unique constraint akan handle tapi kita cek dulu untuk pesan yang lebih baik)
    const existing = await this.ratings.findOne({
      where: {
        userId: actor.id,
        venueId: dto.venueId,
        courtId: dto.courtId ? dto.courtId : IsNull(),
      },
    });
    if (existing) {
      throw new ConflictException('You have already rated this venue/court');
    }

    // Buat rating
    const rating = this.ratings.create({
      userId: actor.id,
      venueId: dto.venueId,
      courtId: dto.courtId ?? null,
      score: dto.score,
    });
    const savedRating = await this.ratings.save(rating);

    // Buat review jika ada comment
    let review: Review | null = null;
    if (dto.comment?.trim()) {
      review = this.reviews.create({
        ratingId: savedRating.id,
        comment: dto.comment.trim(),
      });
      await this.reviews.save(review);
    }

    return this.toPublic(savedRating, review);
  }

  /** GET /api/venues/:venueId/ratings — list rating venue dengan pagination. */
  async listByVenue(venueId: string, query: ListRatingsDto): Promise<PaginatedRatings> {
    const venue = await this.venues.findOne({ where: { id: venueId } });
    if (!venue) throw new NotFoundException('Venue not found');

    return this.listRatings({ venueId, courtId: null }, query);
  }

  /** GET /api/courts/:courtId/ratings — list rating court dengan pagination. */
  async listByCourt(courtId: string, query: ListRatingsDto): Promise<PaginatedRatings> {
    const court = await this.courts.findOne({ where: { id: courtId } });
    if (!court) throw new NotFoundException('Court not found');

    return this.listRatings({ venueId: court.venueId, courtId }, query);
  }

  /** GET /api/ratings/:id — detail rating + review. */
  async detail(id: string): Promise<RatingItem> {
    const rating = await this.ratings.findOne({
      where: { id },
      relations: { user: true, review: true },
    });
    if (!rating) throw new NotFoundException('Rating not found');

    return this.toPublic(rating, rating.review ?? null);
  }

  /** PUT /api/ratings/:id — update rating/review (auth, owner only). */
  async update(id: string, actor: ActorInput, dto: UpdateRatingDto): Promise<RatingItem> {
    const rating = await this.ratings.findOne({
      where: { id },
      relations: { review: true },
    });
    if (!rating) throw new NotFoundException('Rating not found');

    // Cek ownership
    assertOwnerOrAdmin(actor, rating.userId);

    // Update score
    if (dto.score !== undefined) {
      rating.score = dto.score;
    }

    // Update review
    if (dto.comment !== undefined) {
      if (dto.comment.trim()) {
        if (rating.review) {
          rating.review.comment = dto.comment.trim();
          await this.reviews.save(rating.review);
        } else {
          const review = this.reviews.create({
            ratingId: rating.id,
            comment: dto.comment.trim(),
          });
          rating.review = await this.reviews.save(review);
        }
      } else {
        // Comment dihapus (empty string)
        if (rating.review) {
          await this.reviews.remove(rating.review);
          rating.review = null;
        }
      }
    }

    const saved = await this.ratings.save(rating);
    return this.toPublic(saved, rating.review ?? null);
  }

  /** DELETE /api/ratings/:id — hapus rating (auth, owner/admin). Hard delete. */
  async delete(id: string, actor: ActorInput): Promise<void> {
    const rating = await this.ratings.findOne({ where: { id } });
    if (!rating) throw new NotFoundException('Rating not found');

    assertOwnerOrAdmin(actor, rating.userId);

    // Hard delete rating (cascade akan hapus review karena cascade: true di entity)
    await this.ratings.remove(rating);
  }

  /** Helper: list ratings dengan filter venueId + courtId. */
  private async listRatings(
    filter: { venueId: string; courtId: string | null },
    query: ListRatingsDto,
  ): Promise<PaginatedRatings> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortBy = query.sortBy ?? RatingSortBy.LATEST;

    const qb = this.ratings
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.user', 'user')
      .leftJoinAndSelect('r.review', 'review')
      .where('r.venueId = :venueId', { venueId: filter.venueId })
      .andWhere('r.courtId IS ' + (filter.courtId ? ':courtId' : 'NULL'), filter.courtId ? { courtId: filter.courtId } : {})
      .skip((page - 1) * limit)
      .take(limit);

    // Sorting
    switch (sortBy) {
      case RatingSortBy.HIGHEST:
        qb.orderBy('r.score', 'DESC').addOrderBy('r.createdAt', 'DESC');
        break;
      case RatingSortBy.LOWEST:
        qb.orderBy('r.score', 'ASC').addOrderBy('r.createdAt', 'DESC');
        break;
      case RatingSortBy.LATEST:
      default:
        qb.orderBy('r.createdAt', 'DESC');
        break;
    }

    const [rows, total] = await qb.getManyAndCount();

    return {
      data: rows.map((r) => this.toPublic(r, r.review ?? null)),
      meta: { page, limit, total },
    };
  }

  /** Transform Rating entity ke public response format. */
  private toPublic(rating: Rating, review: Review | null): RatingItem {
    return {
      id: rating.id,
      userId: rating.userId,
      user: {
        id: rating.user?.id ?? rating.userId,
        email: rating.user?.email ?? '',
        displayName: rating.user?.displayName ?? null,
        avatarUrl: rating.user?.avatarUrl ?? null,
      },
      venueId: rating.venueId,
      courtId: rating.courtId ?? null,
      score: rating.score,
      review: review
        ? {
            id: review.id,
            comment: review.comment ?? null,
            createdAt: review.createdAt,
            updatedAt: review.updatedAt,
          }
        : null,
      createdAt: rating.createdAt,
      updatedAt: rating.updatedAt,
    };
  }
}