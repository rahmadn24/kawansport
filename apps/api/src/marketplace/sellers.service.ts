import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { ActorInput } from '../auth/ownership';
import { User } from '../users/user.entity';
import { CreateSellerDto } from './dto/create-seller.dto';
import { UpdateSellerDto } from './dto/update-seller.dto';
import { Seller } from './seller.entity';

export interface SellerItem {
  id: string;
  owner: { id: string; email: string; displayName: string | null };
  shopName: string;
  description: string | null;
  status: Seller['status'];
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class SellersService {
  constructor(
    @InjectRepository(Seller)
    private readonly sellers: Repository<Seller>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  /**
   * POST /sellers — apply jadi seller (keputusan PO MP-01).
   * User biasa (role `user`) boleh apply; seller dibuat `pending` dan
   * role user TETAP `user` sampai admin approve (baru jadi `seller`).
   * Satu user hanya boleh punya satu profil seller (duplikat → 409).
   */
  async create(actor: ActorInput, dto: CreateSellerDto): Promise<SellerItem> {
    const existing = await this.sellers.findOne({
      where: { ownerId: actor.id },
    });
    if (existing) {
      throw new ConflictException('Seller profile already exists');
    }
    const seller = this.sellers.create({
      ownerId: actor.id,
      shopName: dto.shopName.trim(),
      description: dto.description?.trim() ? dto.description.trim() : null,
      status: 'pending',
      rejectionReason: null,
    });
    const saved = await this.sellers.save(seller);
    return this.mustLoad(saved.id);
  }

  /** GET /sellers/me — profil seller milik sendiri (404 bila belum apply). */
  async getMine(actor: ActorInput): Promise<SellerItem> {
    const seller = await this.sellers.findOne({
      where: { ownerId: actor.id },
      relations: { owner: true },
    });
    if (!seller) throw new NotFoundException('Seller profile not found');
    return this.toPublic(seller);
  }

  /** PATCH /sellers/me — ubah toko milik sendiri (status tidak berubah). */
  async updateMine(
    actor: ActorInput,
    dto: UpdateSellerDto,
  ): Promise<SellerItem> {
    const seller = await this.sellers.findOne({
      where: { ownerId: actor.id },
    });
    if (!seller) throw new NotFoundException('Seller profile not found');
    if (dto.shopName !== undefined) seller.shopName = dto.shopName.trim();
    if (dto.description !== undefined) {
      seller.description = dto.description?.trim()
        ? dto.description.trim()
        : null;
    }
    return this.toPublic(await this.sellers.save(seller));
  }

  /** GET /sellers/pending — antrean moderasi (khusus super_admin). */
  async listPending(): Promise<SellerItem[]> {
    return this.listAll('pending');
  }

  /**
   * GET /admin/sellers — semua status untuk CMS (khusus super_admin).
   * Filter status opsional; sort createdAt DESC (terbaru dulu).
   */
  async listAll(status?: Seller['status']): Promise<SellerItem[]> {
    const rows = await this.sellers.find({
      ...(status ? { where: { status } } : {}),
      relations: { owner: true },
      order: { createdAt: 'DESC' },
    });
    return rows.map((s) => this.toPublic(s));
  }

  /**
   * POST /sellers/:id/approve — pending -> approved (khusus super_admin).
   * Efek samping: `users.role` pemilik jadi `seller` (kecuali super_admin).
   */
  async approve(id: string): Promise<SellerItem> {
    const seller = await this.sellers.findOne({ where: { id } });
    if (!seller) throw new NotFoundException('Seller not found');
    if (seller.status !== 'pending') {
      throw new ConflictException('Only pending sellers can be approved');
    }
    seller.status = 'approved';
    seller.rejectionReason = null;
    await this.sellers.save(seller);

    const owner = await this.users.findOne({ where: { id: seller.ownerId } });
    if (owner && owner.role === 'user') {
      await this.users.update({ id: owner.id }, { role: 'seller' });
    }
    return this.mustLoad(id);
  }

  /** POST /sellers/:id/reject — pending -> rejected + alasan (super_admin). */
  async reject(id: string, reason?: string): Promise<SellerItem> {
    const seller = await this.sellers.findOne({ where: { id } });
    if (!seller) throw new NotFoundException('Seller not found');
    if (seller.status !== 'pending') {
      throw new ConflictException('Only pending sellers can be rejected');
    }
    seller.status = 'rejected';
    seller.rejectionReason = reason?.trim() ? reason.trim() : null;
    await this.sellers.save(seller);
    return this.mustLoad(id);
  }

  private async mustLoad(id: string): Promise<SellerItem> {
    const seller = await this.sellers.findOne({
      where: { id },
      relations: { owner: true },
    });
    if (!seller) throw new NotFoundException('Seller not found');
    return this.toPublic(seller);
  }

  toPublic(s: Seller): SellerItem {
    return {
      id: s.id,
      owner: {
        id: s.owner?.id ?? s.ownerId,
        email: s.owner?.email ?? '',
        displayName: s.owner?.displayName ?? null,
      },
      shopName: s.shopName,
      description: s.description ?? null,
      status: s.status,
      rejectionReason: s.rejectionReason ?? null,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    };
  }
}
