import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isOwnerOrAdmin } from '../auth/ownership';
import type { ActorInput } from '../auth/ownership';
import {
  PRODUCT_SENSITIVE_FIELDS,
  buildProductPayload,
  hasSensitiveKeys,
} from '../change-requests/entity-patches';
import {
  ChangeRequestsService,
  PendingChangeResponse,
  toPendingChange,
} from '../change-requests/change-requests.service';
import { normalizePhotos } from '../venues/venues.service';
import { assertPhotoUrls } from '../uploads/photo-url';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsDto } from './dto/list-products.dto';
import { SellerDashboardQueryDto } from './dto/seller-dashboard-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './product.entity';
import { Seller } from './seller.entity';

/** Batas foto produk (ST-01). */
export const MAX_PRODUCT_PHOTOS = 5;

export interface ProductItem {
  id: string;
  seller: { id: string; shopName: string; ownerId: string };
  category: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  photos: string[];
  status: Product['status'];
  rejectionReason: string | null;
  /** Id editor terakhir (AD-02, jejak audit; null bila belum pernah diubah). */
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
    @InjectRepository(Seller)
    private readonly sellers: Repository<Seller>,
    private readonly changeRequests: ChangeRequestsService,
  ) {}

  /**
   * POST /products — hanya seller yang profilnya `approved` (milik sendiri).
   * Cek ke DB (bukan klaim role token) agar token lama pra-approve tetap valid.
   * Produk baru langsung `pending` (menunggu moderasi admin).
   */
  async create(
    actor: ActorInput,
    dto: CreateProductDto,
  ): Promise<ProductItem> {
    const seller = await this.requireApprovedSeller(actor);
    const product = this.products.create({
      sellerId: seller.id,
      category: dto.category.trim(),
      name: dto.name.trim(),
      description: dto.description?.trim() ? dto.description.trim() : null,
      price: dto.price,
      stock: dto.stock,
      photos: validateProductPhotos(normalizePhotos(dto.photos ?? [])),
      status: 'pending',
      rejectionReason: null,
    });
    return this.mustLoad((await this.products.save(product)).id);
  }

  /**
   * PATCH /products/:id — pemilik produk (via seller miliknya) atau super_admin.
   * Lintas seller → 403.
   * AD-02: bila editor BUKAN admin dan produk sudah `approved` serta payload
   * menyentuh field sensitif (name, price, photos, description) → TIDAK
   * langsung diubah, melainkan change request `pending` (202 + CR id, publik
   * tetap data lama). Edit non-sensitif atas approved langsung berlaku tanpa
   * mengubah status; edit owner atas produk `rejected` me-reset ke `pending`
   * (moderasi ulang, seperti sebelumnya); edit admin tak mengubah status.
   */
  async update(
    id: string,
    actor: ActorInput,
    dto: UpdateProductDto,
  ): Promise<ProductItem | PendingChangeResponse> {
    const product = await this.products.findOne({
      where: { id },
      relations: { seller: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    const sellerOwnerId = product.seller?.ownerId ?? null;
    const isAdmin = actor.role === 'super_admin';
    if (!isAdmin) {
      const mine = await this.sellers.findOne({
        where: { ownerId: actor.id },
      });
      if (!mine || mine.id !== product.sellerId) {
        throw new ForbiddenException('Forbidden: not the product owner');
      }
    } else if (sellerOwnerId === null) {
      const seller = await this.sellers.findOne({
        where: { id: product.sellerId },
      });
      if (!seller) throw new NotFoundException('Product not found');
    }

    if (
      !isAdmin &&
      product.status === 'approved' &&
      hasSensitiveKeys(dto as Record<string, unknown>, PRODUCT_SENSITIVE_FIELDS)
    ) {
      const cr = await this.changeRequests.create({
        entityType: 'product',
        entityId: product.id,
        payload: buildProductPayload(dto) as Record<string, unknown>,
        requestedBy: actor.id,
      });
      return toPendingChange(cr);
    }

    const patch = buildProductPayload(dto);
    if (patch.category !== undefined) product.category = patch.category;
    if (patch.name !== undefined) product.name = patch.name;
    if (patch.description !== undefined) {
      product.description = patch.description;
    }
    if (patch.price !== undefined) product.price = patch.price;
    if (patch.stock !== undefined) product.stock = patch.stock;
    if (patch.photos !== undefined) {
      product.photos = validateProductPhotos(normalizePhotos(patch.photos));
    }
    product.updatedBy = actor.id;

    // Edit owner atas produk `rejected` = pengajuan ulang (kembali `pending`);
    // produk `approved` yang diedit langsung (non-sensitif) tetap `approved`.
    if (!isAdmin && product.status === 'rejected') {
      product.status = 'pending';
      product.rejectionReason = null;
    }
    return this.toPublic(await this.products.save(product));
  }

  /** POST /products/:id/approve — pending -> approved (khusus super_admin). */
  async approve(id: string, actorId?: string): Promise<ProductItem> {
    const product = await this.products.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    if (product.status !== 'pending') {
      throw new ConflictException('Only pending products can be approved');
    }
    product.status = 'approved';
    product.rejectionReason = null;
    if (actorId) product.updatedBy = actorId;
    await this.products.save(product);
    return this.mustLoad(id);
  }

  /** POST /products/:id/reject — pending -> rejected + alasan (super_admin). */
  async reject(
    id: string,
    reason?: string,
    actorId?: string,
  ): Promise<ProductItem> {
    const product = await this.products.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    if (product.status !== 'pending') {
      throw new ConflictException('Only pending products can be rejected');
    }
    product.status = 'rejected';
    product.rejectionReason = reason?.trim() ? reason.trim() : null;
    if (actorId) product.updatedBy = actorId;
    await this.products.save(product);
    return this.mustLoad(id);
  }

  /**
   * GET /products — publik, HANYA produk approved.
   * Filter search (name+description, substring case-insensitive),
   * category (persis case-insensitive), seller (sellerId), pagination + meta.
   * Filter di memori agar portabel postgres/sqljs.
   */
  async list(query: ListProductsDto): Promise<{
    data: ProductItem[];
    meta: { page: number; limit: number; total: number };
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim().toLowerCase() || null;
    const category = query.category?.trim().toLowerCase() || null;

    const rows = await this.products.find({
      where: { status: 'approved' },
      relations: { seller: true },
      order: { createdAt: 'ASC' },
    });

    const filtered = rows.filter((p) => {
      if (query.seller && p.sellerId !== query.seller) return false;
      if (category && p.category.toLowerCase() !== category) return false;
      if (search) {
        const hay = `${p.name}\n${p.description ?? ''}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

    const total = filtered.length;
    const slice = filtered.slice((page - 1) * limit, page * limit);
    return {
      data: slice.map((p) => this.toPublic(p)),
      meta: { page, limit, total },
    };
  }

  /**
   * GET /admin/products — semua status untuk CMS (khusus super_admin).
   * Filter status opsional; sort createdAt DESC (terbaru dulu).
   */
  async listForAdmin(status?: Product['status']): Promise<{
    data: ProductItem[];
    meta: { total: number };
  }> {
    const rows = await this.products.find({
      relations: { seller: true },
      order: { createdAt: 'DESC' },
    });
    const filtered = status ? rows.filter((p) => p.status === status) : rows;
    return {
      data: filtered.map((p) => this.toPublic(p)),
      meta: { total: filtered.length },
    };
  }

  /** GET /products/pending — antrean moderasi (khusus super_admin). */
  async listPending(): Promise<ProductItem[]> {
    const rows = await this.products.find({
      where: { status: 'pending' },
      relations: { seller: true },
      order: { createdAt: 'ASC' },
    });
    return rows.map((p) => this.toPublic(p));
  }

  /**
   * GET /products/mine — SEMUA produk milik toko sendiri (pending, approved,
   * maupun rejected), terbaru dulu. Dipakai dashboard toko CMS (pengganti
   * list publik yang hanya memuat approved). Tanpa profil seller → 404
   * jujur (bukan array kosong) agar client bisa mengarahkan onboarding.
   * Shape item = ProductItem yang sama dengan list publik + meta.
   */
  async listMine(
    actor: ActorInput,
    query: SellerDashboardQueryDto,
  ): Promise<{
    data: ProductItem[];
    meta: { page: number; limit: number; total: number };
  }> {
    const seller = await this.sellers.findOne({
      where: { ownerId: actor.id },
    });
    if (!seller) {
      throw new NotFoundException('Belum punya toko (seller profile not found)');
    }
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const rows = await this.products.find({
      where: { sellerId: seller.id },
      relations: { seller: true },
      order: { createdAt: 'DESC' },
    });
    const total = rows.length;
    const slice = rows.slice((page - 1) * limit, page * limit);
    return {
      data: slice.map((p) => this.toPublic(p)),
      meta: { page, limit, total },
    };
  }

  /**
   * GET /products/:id — publik untuk produk approved; produk non-approved
   * disembunyikan (404) kecuali dilihat pemiliknya / super_admin.
   */
  async detail(id: string, actor?: ActorInput | null): Promise<ProductItem> {
    const product = await this.products.findOne({
      where: { id },
      relations: { seller: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (product.status !== 'approved') {
      const ownerId = product.seller?.ownerId;
      if (!actor || !ownerId || !isOwnerOrAdmin(actor, ownerId)) {
        throw new NotFoundException('Product not found');
      }
    }
    return this.toPublic(product);
  }

  /** Seller approved milik actor, atau 403 bila belum ada / belum approved. */
  private async requireApprovedSeller(actor: ActorInput): Promise<Seller> {
    const seller = await this.sellers.findOne({
      where: { ownerId: actor.id },
    });
    if (!seller) {
      throw new ForbiddenException('Forbidden: seller profile required');
    }
    if (seller.status !== 'approved') {
      throw new ForbiddenException('Forbidden: seller not approved');
    }
    return seller;
  }

  private async mustLoad(id: string): Promise<ProductItem> {
    const product = await this.products.findOne({
      where: { id },
      relations: { seller: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    return this.toPublic(product);
  }

  toPublic(p: Product): ProductItem {
    return {
      id: p.id,
      seller: {
        id: p.seller?.id ?? p.sellerId,
        shopName: p.seller?.shopName ?? '',
        ownerId: p.seller?.ownerId ?? '',
      },
      category: p.category,
      name: p.name,
      description: p.description ?? null,
      price: p.price,
      stock: p.stock,
      photos: p.photos ?? [],
      status: p.status,
      rejectionReason: p.rejectionReason ?? null,
      updatedBy: p.updatedBy ?? null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }
}

/** Normalisasi + validasi URL foto produk (maks 5, /uploads/ atau https). */
export function validateProductPhotos(input: string[]): string[] {
  assertPhotoUrls(input, MAX_PRODUCT_PHOTOS, 'Product photos');
  return input;
}
