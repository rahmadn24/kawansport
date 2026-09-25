import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { normalizeSports } from '../users/users.service';
import { assertPhotoUrls } from '../uploads/photo-url';
import { Court } from '../venues/court.entity';
import { Venue } from '../venues/venue.entity';
import { Product } from '../marketplace/product.entity';
import {
  normalizeProductBadge,
  normalizeProductVariants,
} from '../marketplace/product-variants';
import {
  buildCourtPayload,
  buildProductPayload,
  buildVenuePayload,
  normalizePhotoList,
} from './entity-patches';
import {
  ChangeRequest,
  ChangeRequestEntityType,
  ChangeRequestStatus,
} from './change-request.entity';
import { ListChangeRequestsDto } from './dto/list-change-requests.dto';

export interface ChangeRequestItem {
  id: string;
  entityType: ChangeRequestEntityType;
  entityId: string;
  payload: Record<string, unknown>;
  status: ChangeRequestStatus;
  requestedBy: string;
  reviewedBy: string | null;
  reason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Respons PATCH saat edit dialihkan menjadi change request (AD-02).
 * Controller memetakannya ke HTTP 202 (lihat `isPendingChange`).
 */
export interface PendingChangeResponse {
  pendingReview: true;
  changeRequestId: string;
  entityType: ChangeRequestEntityType;
  entityId: string;
  status: 'pending';
  message: string;
}

/** Type guard untuk respons 202 (dipakai controller venues/products). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isPendingChange(r: unknown): r is PendingChangeResponse {
  return (
    typeof r === 'object' &&
    r !== null &&
    (r as any).pendingReview === true &&
    typeof (r as any).changeRequestId === 'string'
  );
}

export function toPendingChange(
  cr: ChangeRequest,
): PendingChangeResponse {
  return {
    pendingReview: true,
    changeRequestId: cr.id,
    entityType: cr.entityType,
    entityId: cr.entityId,
    status: 'pending',
    message:
      'Perubahan menunggu persetujuan admin; data publik tetap versi lama.',
  };
}

@Injectable()
export class ChangeRequestsService {
  constructor(
    @InjectRepository(ChangeRequest)
    private readonly changeRequests: Repository<ChangeRequest>,
    @InjectRepository(Venue)
    private readonly venues: Repository<Venue>,
    @InjectRepository(Court)
    private readonly courts: Repository<Court>,
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
  ) {}

  /**
   * Catat permintaan perubahan (dipanggil service venues/products saat
   * owner/seller mengedit field sensitif atas entity `approved`).
   * Payload kosong → 400 (pemanggil semestinya sudah menyaring).
   */
  async create(input: {
    entityType: ChangeRequestEntityType;
    entityId: string;
    payload: Record<string, unknown>;
    requestedBy: string;
  }): Promise<ChangeRequest> {
    if (!input.payload || Object.keys(input.payload).length === 0) {
      throw new BadRequestException('Nothing to request');
    }
    const cr = this.changeRequests.create({
      entityType: input.entityType,
      entityId: input.entityId,
      payload: input.payload,
      status: 'pending',
      requestedBy: input.requestedBy,
      reviewedBy: null,
      reason: null,
    });
    return this.changeRequests.save(cr);
  }

  /** GET /me/change-requests — daftar milik sendiri + filter opsional. */
  async listMine(
    userId: string,
    query: ListChangeRequestsDto,
  ): Promise<{
    data: ChangeRequestItem[];
    meta: { page: number; limit: number; total: number };
  }> {
    return this.list({ ...query }, { requestedBy: userId });
  }

  /** GET /admin/change-requests — antrean moderasi + filter status/tipe. */
  async listAll(
    query: ListChangeRequestsDto,
  ): Promise<{
    data: ChangeRequestItem[];
    meta: { page: number; limit: number; total: number };
  }> {
    return this.list({ ...query }, null);
  }

  private async list(
    query: ListChangeRequestsDto,
    owner: { requestedBy: string } | null,
  ): Promise<{
    data: ChangeRequestItem[];
    meta: { page: number; limit: number; total: number };
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    // Filter di memori agar portabel postgres/sqljs (volume antrean kecil).
    const rows = await this.changeRequests.find({
      order: { createdAt: 'ASC' },
    });
    const filtered = rows.filter((r) => {
      if (owner && r.requestedBy !== owner.requestedBy) return false;
      if (query.status && r.status !== query.status) return false;
      if (query.entityType && r.entityType !== query.entityType) return false;
      if (query.entityId && r.entityId !== query.entityId) return false;
      return true;
    });
    const total = filtered.length;
    const slice = filtered.slice((page - 1) * limit, page * limit);
    return {
      data: slice.map((r) => this.toPublic(r)),
      meta: { page, limit, total },
    };
  }

  /**
   * POST /admin/change-requests/:id/approve — terapkan payload ke entity
   * (atomik: entity + CR dalam satu transaksi) lalu tandai `approved`.
   * Hanya CR `pending` (selain itu 409). `updated_by` entity = reviewer.
   */
  async approve(id: string, reviewerId: string): Promise<ChangeRequestItem> {
    const cr = await this.changeRequests.findOne({ where: { id } });
    if (!cr) throw new NotFoundException('Change request not found');
    if (cr.status !== 'pending') {
      throw new ConflictException('Only pending change requests can be approved');
    }
    await this.changeRequests.manager.transaction(async (mgr) => {
      await this.applyPayload(
        mgr.getRepository(Venue),
        mgr.getRepository(Court),
        mgr.getRepository(Product),
        cr,
        reviewerId,
      );
      cr.status = 'approved';
      cr.reviewedBy = reviewerId;
      cr.reason = null;
      await mgr.getRepository(ChangeRequest).save(cr);
    });
    const fresh = await this.changeRequests.findOne({ where: { id } });
    return this.toPublic(fresh ?? cr);
  }

  /**
   * POST /admin/change-requests/:id/reject — tandai `rejected` + alasan.
   * Entity TIDAK berubah (publik tetap data lama). Hanya `pending` (409).
   */
  async reject(
    id: string,
    reviewerId: string,
    reason?: string,
  ): Promise<ChangeRequestItem> {
    const cr = await this.changeRequests.findOne({ where: { id } });
    if (!cr) throw new NotFoundException('Change request not found');
    if (cr.status !== 'pending') {
      throw new ConflictException('Only pending change requests can be rejected');
    }
    cr.status = 'rejected';
    cr.reviewedBy = reviewerId;
    cr.reason = reason?.trim() ? reason.trim() : null;
    return this.toPublic(await this.changeRequests.save(cr));
  }

  /**
   * Terapkan payload CR ke entity target (dipakai dalam transaksi approve).
   * Normalisasi diulang via builder yang sama dengan path edit langsung,
   * sehingga hasil approve identik dengan edit admin langsung.
   */
  private async applyPayload(
    venues: Repository<Venue>,
    courts: Repository<Court>,
    products: Repository<Product>,
    cr: ChangeRequest,
    reviewerId: string,
  ): Promise<void> {
    if (cr.entityType === 'venue') {
      const venue = await venues.findOne({ where: { id: cr.entityId } });
      if (!venue) throw new NotFoundException('Venue not found');
      this.applyToVenue(venue, cr.payload);
      venue.updatedBy = reviewerId;
      await venues.save(venue);
      return;
    }
    if (cr.entityType === 'court') {
      const court = await courts.findOne({ where: { id: cr.entityId } });
      if (!court) throw new NotFoundException('Court not found');
      this.applyToCourt(court, cr.payload);
      court.updatedBy = reviewerId;
      await courts.save(court);
      return;
    }
    const product = await products.findOne({ where: { id: cr.entityId } });
    if (!product) throw new NotFoundException('Product not found');
    this.applyToProduct(product, cr.payload);
    product.updatedBy = reviewerId;
    await products.save(product);
  }

  private applyToVenue(venue: Venue, payload: Record<string, unknown>): void {
    const patch = buildVenuePayload(payload);
    if (patch.name !== undefined) venue.name = patch.name;
    if (patch.address !== undefined) venue.address = patch.address;
    if (patch.lat !== undefined && patch.lng !== undefined) {
      venue.lat = patch.lat;
      venue.lng = patch.lng;
    }
    if (patch.sports !== undefined) {
      venue.sports = normalizeSports(patch.sports);
    }
    if (patch.photos !== undefined) {
      const photos = normalizePhotoList(patch.photos);
      assertPhotoUrls(photos, 5, 'Venue photos');
      venue.photos = photos;
    }
    if (patch.facilities !== undefined) {
      venue.facilities = patch.facilities;
    }
  }

  private applyToCourt(court: Court, payload: Record<string, unknown>): void {
    const patch = buildCourtPayload(payload);
    if (patch.sport !== undefined) court.sport = patch.sport;
    if (patch.name !== undefined) court.name = patch.name;
    if (patch.pricePerHour !== undefined) court.pricePerHour = patch.pricePerHour;
    if (patch.openHours !== undefined) court.openHours = patch.openHours;
    if (patch.status !== undefined) court.status = patch.status;
    if (patch.facilities !== undefined) court.facilities = patch.facilities;
  }

  private applyToProduct(
    product: Product,
    payload: Record<string, unknown>,
  ): void {
    const patch = buildProductPayload(payload);
    if (patch.category !== undefined) product.category = patch.category;
    if (patch.name !== undefined) product.name = patch.name;
    if (patch.description !== undefined) product.description = patch.description;
    if (patch.price !== undefined) product.price = patch.price;
    if (patch.stock !== undefined) product.stock = patch.stock;
    if (patch.variants !== undefined) {
      // ST-05: varian sensitif — validasi ulang via helper yang sama dengan
      // path edit langsung agar hasil approve identik.
      product.variants = normalizeProductVariants(patch.variants);
    }
    if (patch.badge !== undefined) {
      product.badge = normalizeProductBadge(patch.badge);
    }
    if (patch.photos !== undefined) {
      const photos = normalizePhotoList(patch.photos);
      assertPhotoUrls(photos, 5, 'Product photos');
      product.photos = photos;
    }
  }

  toPublic(cr: ChangeRequest): ChangeRequestItem {
    return {
      id: cr.id,
      entityType: cr.entityType,
      entityId: cr.entityId,
      payload: cr.payload ?? {},
      status: cr.status,
      requestedBy: cr.requestedBy,
      reviewedBy: cr.reviewedBy ?? null,
      reason: cr.reason ?? null,
      createdAt: cr.createdAt,
      updatedAt: cr.updatedAt,
    };
  }
}
