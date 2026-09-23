import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { RequestUser } from '../auth/jwt-auth.guard';
import { assertOwnerOrAdmin } from '../auth/ownership';
import { Booking } from '../bookings/booking.entity';
import { ShopOrderGroup } from '../marketplace/shop-order.entity';
import { Seller } from '../marketplace/seller.entity';
import { SettingsService } from '../settings/settings.service';
import { Court } from '../venues/court.entity';
import { Venue } from '../venues/venue.entity';
import { CreatePayoutDto } from './dto/create-payout.dto';
import type { ApprovePayoutDto } from './dto/handle-payout.dto';
import type { PayPayoutDto } from './dto/handle-payout.dto';
import type { RejectPayoutDto } from './dto/handle-payout.dto';
import {
  PAYOUT_RESERVED_STATUSES,
  Payout,
} from './payout.entity';
import type { PayoutPayeeType, PayoutStatus } from './payout.entity';

export interface PayoutItem {
  id: string;
  payeeType: PayoutPayeeType;
  payeeId: string;
  amount: number;
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
  status: PayoutStatus;
  reference: string | null;
  reason: string | null;
  requestedBy: string;
  handledBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BalanceItem {
  payeeType: PayoutPayeeType;
  payeeId: string;
  /** Total kotor: SUM booking paid (venue) / SUM order-group paid (seller). */
  gross: number;
  /** Komisi platform efektif (%) — reuse API-W03 via PlatformSetting. */
  commissionPercent: number;
  /** gross − komisi (dibulatkan, pola API-W05). */
  net: number;
  /** Total payout approved+paid (yang mengunci saldo). */
  reserved: number;
  /** net − reserved: batas withdraw yang boleh diminta. */
  available: number;
}

export interface BalanceResult {
  payeeType: PayoutPayeeType | null;
  payeeId: string | null;
  gross: number;
  commissionPercent: number;
  net: number;
  reserved: number;
  available: number;
  /** Diisi bila agregat multi-payee (GET tanpa query oleh mitra). */
  breakdown?: BalanceItem[];
}

/**
 * Payout & withdraw mitra (API-W08, catat-dan-approve manual — TANPA
 * integrasi Midtrans disbursement API, keputusan PO FINAL).
 *
 * Saldo read-only dihitung LIVE dari data real (tanpa tabel saldo terpisah
 * agar tidak drift):
 * - venue: SUM(amount) booking `paid` court milik venue → net komisi
 *   (reuse rumus API-W05: round(gmv×(100−commission)/100)).
 * - seller: SUM(subtotal) order_groups `paid` seller tsb → net komisi sama.
 * - dikurangi SUM(amount) payout `approved`+`paid` payee tsb
 *   (`requested`/`rejected` tidak mengunci saldo).
 */
@Injectable()
export class PayoutsService {
  constructor(
    @InjectRepository(Payout)
    private readonly payouts: Repository<Payout>,
    @InjectRepository(Venue)
    private readonly venues: Repository<Venue>,
    @InjectRepository(Court)
    private readonly courts: Repository<Court>,
    @InjectRepository(Booking)
    private readonly bookings: Repository<Booking>,
    @InjectRepository(Seller)
    private readonly sellers: Repository<Seller>,
    @InjectRepository(ShopOrderGroup)
    private readonly groups: Repository<ShopOrderGroup>,
    private readonly settings: SettingsService,
  ) {}

  /**
   * POST /payouts — ajukan withdraw.
   * Guard kepemilikan: venue/seller harus milik actor (super_admin lolos).
   * amount ≤ saldo tersedia, else 409; payee tak ada → 404.
   */
  async create(
    actor: RequestUser,
    dto: CreatePayoutDto,
  ): Promise<PayoutItem> {
    const ownerId = await this.assertPayeeOwned(actor, dto.payeeType, dto.payeeId);
    void ownerId;
    const balance = await this.balanceOne(dto.payeeType, dto.payeeId);
    if (dto.amount > balance.available) {
      throw new ConflictException(
        `Insufficient balance (available: ${balance.available})`,
      );
    }
    const payout = await this.payouts.save(
      this.payouts.create({
        payeeType: dto.payeeType,
        payeeId: dto.payeeId,
        amount: dto.amount,
        bankName: dto.bankName ?? null,
        accountNumber: dto.accountNumber ?? null,
        accountName: dto.accountName ?? null,
        status: 'requested',
        requestedBy: actor.id,
      }),
    );
    return toPayoutItem(payout);
  }

  /**
   * GET /payouts/me — riwayat milik sendiri: yang diminta oleh actor ATAU
   * yang payee-nya dimiliki actor (agar request admin untuk payee-nya tetap
   * terlihat). Terbaru dulu.
   */
  async listMine(actor: RequestUser): Promise<{ data: PayoutItem[] }> {
    const [venueIds, sellerIds] = await Promise.all([
      this.ownedVenueIds(actor.id),
      this.ownedSellerIds(actor.id),
    ]);
    const qb = this.payouts
      .createQueryBuilder('p')
      .where('p.requestedBy = :actorId', { actorId: actor.id });
    const orParams: Record<string, unknown> = {};
    const orClauses: string[] = [];
    if (venueIds.length > 0) {
      orClauses.push(`(p.payee_type = 'venue' AND p.payee_id IN (:...venueIds))`);
      orParams.venueIds = venueIds;
    }
    if (sellerIds.length > 0) {
      orClauses.push(`(p.payee_type = 'seller' AND p.payee_id IN (:...sellerIds))`);
      orParams.sellerIds = sellerIds;
    }
    if (orClauses.length > 0) {
      qb.orWhere(`(${orClauses.join(' OR ')})`, orParams);
    }
    const rows = await qb.orderBy('p.created_at', 'DESC').getMany();
    return { data: rows.map(toPayoutItem) };
  }

  /**
   * GET /payouts/balance — saldo read-only.
   * - Dengan ?payeeType=&payeeId=: satu payee (wajib milik actor / admin).
   * - Tanpa query: agregat semua payee milik actor (+ breakdown per payee).
   *   Super_admin tanpa query → 400 (harus tunjuk payee).
   */
  async balance(
    actor: RequestUser,
    payeeType?: PayoutPayeeType,
    payeeId?: string,
  ): Promise<BalanceResult> {
    if ((payeeType == null) !== (payeeId == null)) {
      throw new BadRequestException(
        'payeeType and payeeId must be provided together',
      );
    }
    if (payeeType && payeeId) {
      await this.assertPayeeOwned(actor, payeeType, payeeId);
      return this.balanceOne(payeeType, payeeId);
    }
    if (actor.role === 'super_admin') {
      throw new BadRequestException(
        'super_admin must specify payeeType and payeeId',
      );
    }
    const [venueIds, sellerIds] = await Promise.all([
      this.ownedVenueIds(actor.id),
      this.ownedSellerIds(actor.id),
    ]);
    const items: BalanceItem[] = [];
    for (const id of venueIds) items.push(await this.balanceOne('venue', id));
    for (const id of sellerIds) items.push(await this.balanceOne('seller', id));
    const gross = items.reduce((s, b) => s + b.gross, 0);
    const net = items.reduce((s, b) => s + b.net, 0);
    const reserved = items.reduce((s, b) => s + b.reserved, 0);
    const commission = await this.settings.getEffectiveCommissionPercent();
    return {
      payeeType: null,
      payeeId: null,
      gross,
      commissionPercent: commission.effective,
      net,
      reserved,
      available: net - reserved,
      breakdown: items,
    };
  }

  /** GET /payouts — antrean admin (khusus super_admin) + filter `status?`. */
  async listForAdmin(status?: PayoutStatus): Promise<{
    data: PayoutItem[];
    meta: { total: number };
  }> {
    const rows = await this.payouts.find({ order: { createdAt: 'DESC' } });
    const filtered = status ? rows.filter((p) => p.status === status) : rows;
    return {
      data: filtered.map(toPayoutItem),
      meta: { total: filtered.length },
    };
  }

  /**
   * POST /payouts/:id/approve — requested → approved (khusus super_admin).
   * Reference transfer manual opsional di tahap ini (wajib saat pay).
   */
  async approve(
    id: string,
    actor: RequestUser,
    dto: ApprovePayoutDto,
  ): Promise<PayoutItem> {
    const payout = await this.findOrThrow(id);
    if (payout.status !== 'requested') {
      throw new ConflictException(
        `Only requested payouts can be approved (current: ${payout.status})`,
      );
    }
    payout.status = 'approved';
    if (dto.reference?.trim()) payout.reference = dto.reference.trim();
    payout.handledBy = actor.id;
    return toPayoutItem(await this.payouts.save(payout));
  }

  /**
   * POST /payouts/:id/reject — requested → rejected (khusus super_admin).
   * Rejected tidak mengunci saldo (available kembali penuh).
   */
  async reject(
    id: string,
    actor: RequestUser,
    dto: RejectPayoutDto,
  ): Promise<PayoutItem> {
    const payout = await this.findOrThrow(id);
    if (payout.status !== 'requested') {
      throw new ConflictException(
        `Only requested payouts can be rejected (current: ${payout.status})`,
      );
    }
    payout.status = 'rejected';
    payout.reason = dto.reason?.trim() ? dto.reason.trim() : null;
    payout.handledBy = actor.id;
    return toPayoutItem(await this.payouts.save(payout));
  }

  /**
   * POST /payouts/:id/pay — approved → paid (khusus super_admin).
   * Menandai transfer manual sudah dilakukan; reference WAJIB (400 bila kosong).
   */
  async markPaid(
    id: string,
    actor: RequestUser,
    dto: PayPayoutDto,
  ): Promise<PayoutItem> {
    const payout = await this.findOrThrow(id);
    if (payout.status !== 'approved') {
      throw new ConflictException(
        `Only approved payouts can be marked paid (current: ${payout.status})`,
      );
    }
    if (!dto.reference?.trim()) {
      throw new BadRequestException('reference is required when marking paid');
    }
    payout.status = 'paid';
    payout.reference = dto.reference.trim();
    payout.handledBy = actor.id;
    return toPayoutItem(await this.payouts.save(payout));
  }

  // ---- Hitung saldo (live, tanpa tabel terpisah) ----

  /** Saldo satu payee: gross → net komisi → reserved → available. */
  private async balanceOne(
    payeeType: PayoutPayeeType,
    payeeId: string,
  ): Promise<BalanceItem> {
    const commission = await this.settings.getEffectiveCommissionPercent();
    const gross =
      payeeType === 'venue'
        ? await this.venueGross(payeeId)
        : await this.sellerGross(payeeId);
    const net = Math.round((gross * (100 - commission.effective)) / 100);
    const reservedRow = await this.payouts
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.amount), 0)', 'sum')
      .where('p.payee_type = :payeeType', { payeeType })
      .andWhere('p.payee_id = :payeeId', { payeeId })
      .andWhere('p.status IN (:...statuses)', {
        statuses: PAYOUT_RESERVED_STATUSES,
      })
      .getRawOne<{ sum: string }>();
    const reserved = Number(reservedRow?.sum ?? 0);
    return {
      payeeType,
      payeeId,
      gross,
      commissionPercent: commission.effective,
      net,
      reserved,
      available: net - reserved,
    };
  }

  /** SUM(amount) booking paid atas semua court venue ini (pola API-W05). */
  private async venueGross(venueId: string): Promise<number> {
    const courtIds = (
      await this.courts.find({ where: { venueId }, select: { id: true } })
    ).map((c) => c.id);
    if (courtIds.length === 0) return 0;
    const row = await this.bookings
      .createQueryBuilder('b')
      .select('COALESCE(SUM(b.amount), 0)', 'sum')
      .where('b.courtId IN (:...courtIds)', { courtIds })
      .andWhere('b.status = :status', { status: 'paid' })
      .getRawOne<{ sum: string }>();
    return Number(row?.sum ?? 0);
  }

  /** SUM(subtotal) order_groups paid milik seller ini. */
  private async sellerGross(sellerId: string): Promise<number> {
    const row = await this.groups
      .createQueryBuilder('g')
      .select('COALESCE(SUM(g.subtotal), 0)', 'sum')
      .where('g.sellerId = :sellerId', { sellerId })
      .andWhere('g.status = :status', { status: 'paid' })
      .getRawOne<{ sum: string }>();
    return Number(row?.sum ?? 0);
  }

  /**
   * Pastikan payee ada (404) + milik actor (403 lintas owner).
   * Mengembalikan ownerId payee (untuk kejelasan audit pemanggil).
   */
  private async assertPayeeOwned(
    actor: RequestUser,
    payeeType: PayoutPayeeType,
    payeeId: string,
  ): Promise<string> {
    if (payeeType === 'venue') {
      const venue = await this.venues.findOne({ where: { id: payeeId } });
      if (!venue) throw new NotFoundException('Venue not found');
      assertOwnerOrAdmin(actor, venue.ownerId);
      return venue.ownerId;
    }
    const seller = await this.sellers.findOne({ where: { id: payeeId } });
    if (!seller) throw new NotFoundException('Seller not found');
    assertOwnerOrAdmin(actor, seller.ownerId);
    return seller.ownerId;
  }

  private async ownedVenueIds(ownerId: string): Promise<string[]> {
    const rows = await this.venues.find({
      where: { ownerId },
      select: { id: true },
    });
    return rows.map((v) => v.id);
  }

  private async ownedSellerIds(ownerId: string): Promise<string[]> {
    const rows = await this.sellers.find({
      where: { ownerId },
      select: { id: true },
    });
    return rows.map((s) => s.id);
  }

  private async findOrThrow(id: string): Promise<Payout> {
    const payout = await this.payouts.findOne({ where: { id } });
    if (!payout) throw new NotFoundException('Payout not found');
    return payout;
  }
}

/** Guard kepemilikan untuk controller lain yang butuh (sejajar ownership.ts). */
export function assertPayeeOwnerOrAdmin(
  actor: RequestUser,
  ownerId: string,
): void {
  if (actor.role === 'super_admin') return;
  if (actor.id === ownerId) return;
  throw new ForbiddenException('Forbidden: not the owner');
}

export function toPayoutItem(p: Payout): PayoutItem {
  return {
    id: p.id,
    payeeType: p.payeeType,
    payeeId: p.payeeId,
    amount: p.amount,
    bankName: p.bankName ?? null,
    accountNumber: p.accountNumber ?? null,
    accountName: p.accountName ?? null,
    status: p.status,
    reference: p.reference ?? null,
    reason: p.reason ?? null,
    requestedBy: p.requestedBy,
    handledBy: p.handledBy ?? null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}
