import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { UpdateVoucherDto } from './dto/update-voucher.dto';
import {
  Voucher,
  VoucherRedemption,
  VoucherScope,
  VoucherType,
} from './voucher.entity';

export interface VoucherItem {
  id: string;
  code: string;
  type: VoucherType;
  value: number;
  maxDiscount: number | null;
  minTransaction: number;
  quota: number | null;
  perUserLimit: number | null;
  usedCount: number;
  validFrom: Date | null;
  validTo: Date | null;
  applicableTo: VoucherScope;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Kanal redeem: booking lapangan vs order shop (untuk `applicableTo`). */
export type RedeemChannel = 'booking' | 'shop';

export interface RedeemResult {
  /** Diskon rupiah final (integer, sudah di-cap). */
  discount: number;
  /** Kode ternormalisasi (uppercase) untuk snapshot. */
  voucherCode: string;
  /** Id baris redemption (untuk ditautkan ke booking/order pemanggil). */
  redemptionId: string;
}

export interface PointsResult {
  /** Poin terpakai (= rupiah dipotong, 1 poin = Rp1). */
  pointsUsed: number;
}

@Injectable()
export class VouchersService {
  constructor(
    @InjectRepository(Voucher)
    private readonly vouchers: Repository<Voucher>,
    @InjectRepository(VoucherRedemption)
    private readonly redemptions: Repository<VoucherRedemption>,
  ) {}

  // ---- Admin CRUD (super_admin, via controller guard) ----

  /** POST /admin/vouchers — buat voucher baru (code unik, case-insensitive). */
  async create(dto: CreateVoucherDto): Promise<VoucherItem> {
    const code = normalizeCode(dto.code);
    if (!code) throw new BadRequestException('code is required');
    const exists = await this.vouchers.findOne({ where: { code } });
    if (exists) throw new ConflictException('Voucher code already exists');
    const built = this.buildVoucher(new Voucher(), dto, code);
    return toItem(await this.vouchers.save(built));
  }

  /** GET /admin/vouchers — daftar semua, terbaru dulu. */
  async list(): Promise<{ data: VoucherItem[]; meta: { total: number } }> {
    const rows = await this.vouchers.find({ order: { createdAt: 'DESC' } });
    return { data: rows.map(toItem), meta: { total: rows.length } };
  }

  /** GET /admin/vouchers/:id — detail satu voucher. */
  async getOne(id: string): Promise<VoucherItem> {
    return toItem(await this.mustFind(id));
  }

  /** PATCH /admin/vouchers/:id — ubah parsial (termasuk code bila belum dipakai). */
  async update(id: string, dto: UpdateVoucherDto): Promise<VoucherItem> {
    const voucher = await this.mustFind(id);
    if (dto.code !== undefined) {
      const code = normalizeCode(dto.code);
      if (!code) throw new BadRequestException('code is required');
      if (code !== voucher.code) {
        const used = await this.redemptions.count({
          where: { voucherId: voucher.id },
        });
        if (used > 0) {
          throw new ConflictException(
            'Voucher code cannot be changed after it has been used',
          );
        }
        const clash = await this.vouchers.findOne({ where: { code } });
        if (clash) throw new ConflictException('Voucher code already exists');
        voucher.code = code;
      }
    }
    if (dto.type !== undefined) {
      const type = dto.type as VoucherType;
      if (type !== 'percent' && type !== 'fixed') {
        throw new BadRequestException('type must be percent or fixed');
      }
      voucher.type = type;
    }
    // Rentang nilai + validasi silang dicek di bawah (efek gabungan lama+baru).
    if (dto.value !== undefined) voucher.value = dto.value;
    if (dto.maxDiscount !== undefined) voucher.maxDiscount = dto.maxDiscount;
    if (dto.minTransaction !== undefined) voucher.minTransaction = dto.minTransaction;
    if (dto.quota !== undefined) voucher.quota = dto.quota;
    if (dto.perUserLimit !== undefined) voucher.perUserLimit = dto.perUserLimit;
    if (dto.validFrom !== undefined) {
      voucher.validFrom = dto.validFrom ? new Date(dto.validFrom) : null;
    }
    if (dto.validTo !== undefined) {
      voucher.validTo = dto.validTo ? new Date(dto.validTo) : null;
    }
    if (dto.applicableTo !== undefined) {
      const scope = dto.applicableTo as VoucherScope;
      if (scope !== 'booking' && scope !== 'shop' && scope !== 'all') {
        throw new BadRequestException('applicableTo must be booking, shop, or all');
      }
      voucher.applicableTo = scope;
    }
    if (dto.active !== undefined) voucher.active = dto.active;
    assertValueRange(voucher.type, voucher.value);
    assertPeriod(voucher.validFrom ?? null, voucher.validTo ?? null);
    return toItem(await this.vouchers.save(voucher));
  }

  /**
   * POST /admin/vouchers/:id/deactivate — nonaktifkan (tanpa hard delete,
   * aman walau voucher sudah dipakai; redeem berikutnya ditolak 400).
   */
  async deactivate(id: string): Promise<VoucherItem> {
    const voucher = await this.mustFind(id);
    voucher.active = false;
    return toItem(await this.vouchers.save(voucher));
  }

  // ---- Redeem transaksional (dipakai bookings + checkout) ----

  /**
   * Terapkan voucher dalam transaksi pemanggil (`mgr`).
   * Validasi (urutan): ada → aktif → periode → applicableTo → minTransaction
   * (400) → kuota total + perUser (409). Lolos → `usedCount++` + baris
   * redemption (sumber hitung perUser) dan kembalikan diskon.
   * Diskon: percent = floor(subtotal*value/100) capped maxDiscount;
   * fixed = min(value, subtotal). Selalu integer rupiah, min 0.
   */
  async redeemInTransaction(
    mgr: EntityManager,
    input: {
      code: string;
      userId: string;
      subtotal: number;
      channel: RedeemChannel;
    },
  ): Promise<RedeemResult> {
    const code = normalizeCode(input.code);
    if (!code) throw new BadRequestException('voucherCode is required');
    const voucherRepo = mgr.getRepository(Voucher);
    const redemptionRepo = mgr.getRepository(VoucherRedemption);

    const isPostgres = mgr.connection.options.type === 'postgres';
    const voucher = isPostgres
      ? await voucherRepo.findOne({
          where: { code },
          lock: { mode: 'pessimistic_write' },
        })
      : await voucherRepo.findOne({ where: { code } });
    if (!voucher) throw new BadRequestException('Voucher not found');
    if (!voucher.active) throw new BadRequestException('Voucher is not active');

    const now = Date.now();
    if (voucher.validFrom && new Date(voucher.validFrom).getTime() > now) {
      throw new BadRequestException('Voucher is not yet valid');
    }
    if (voucher.validTo && new Date(voucher.validTo).getTime() < now) {
      throw new BadRequestException('Voucher has expired');
    }
    if (voucher.applicableTo !== 'all' && voucher.applicableTo !== input.channel) {
      throw new BadRequestException('Voucher is not applicable to this transaction');
    }
    if (input.subtotal < (voucher.minTransaction ?? 0)) {
      throw new BadRequestException(
        `Transaction does not meet voucher minimum (${voucher.minTransaction})`,
      );
    }
    if (voucher.quota != null && voucher.usedCount >= voucher.quota) {
      throw new ConflictException('Voucher quota exhausted');
    }
    if (voucher.perUserLimit != null) {
      const mine = await redemptionRepo.count({
        where: { voucherId: voucher.id, userId: input.userId },
      });
      if (mine >= voucher.perUserLimit) {
        throw new ConflictException('Voucher usage limit per user reached');
      }
    }

    const discount = calcDiscount(voucher, input.subtotal);

    voucher.usedCount += 1;
    await voucherRepo.save(voucher);
    const redemption = await redemptionRepo.save(
      redemptionRepo.create({
        voucherId: voucher.id,
        userId: input.userId,
        discount,
      }),
    );
    return { discount, voucherCode: voucher.code, redemptionId: redemption.id };
  }

  /**
   * Tautkan baris redemption (yang dibuat `redeemInTransaction`) ke
   * booking/order hasil redeem — untuk audit per user. Dipanggil dalam
   * transaksi yang sama oleh pemanggil.
   */
  async linkRedemption(
    mgr: EntityManager,
    input: { redemptionId: string; bookingId?: string; orderId?: string },
  ): Promise<void> {
    const redemptionRepo = mgr.getRepository(VoucherRedemption);
    const row = await redemptionRepo.findOne({
      where: { id: input.redemptionId },
    });
    if (!row) return;
    if (input.bookingId) row.bookingId = input.bookingId;
    if (input.orderId) row.orderId = input.orderId;
    await redemptionRepo.save(row);
  }

  /**
   * Batalkan redeem (kompensasi Snap-gagal, pola MP-02): hapus baris
   * redemption + `usedCount--`. Idempotent bila baris tak ada.
   */
  async rollbackRedeem(
    mgr: EntityManager,
    input: { voucherCode: string; userId: string; bookingId?: string; orderId?: string },
  ): Promise<void> {
    const voucherRepo = mgr.getRepository(Voucher);
    const redemptionRepo = mgr.getRepository(VoucherRedemption);
    const voucher = await voucherRepo.findOne({
      where: { code: input.voucherCode },
    });
    if (!voucher) return;
    const where: Record<string, string> = {
      voucherId: voucher.id,
      userId: input.userId,
    };
    if (input.bookingId) where.bookingId = input.bookingId;
    if (input.orderId) where.orderId = input.orderId;
    const row = await redemptionRepo.findOne({ where: where as never });
    if (!row) return;
    await redemptionRepo.remove(row);
    voucher.usedCount = Math.max(0, voucher.usedCount - 1);
    await voucherRepo.save(voucher);
  }

  /**
   * Potong Poin Kawan dalam transaksi pemanggil (`mgr`).
   * 1 poin = Rp1, capped `cap` (sisa total setelah voucher). Saldo kurang →
   * 400; saldo tidak pernah negatif (cek + mutasi dalam satu transaksi).
   */
  async deductPointsInTransaction(
    mgr: EntityManager,
    input: { userId: string; requested: number; cap: number },
  ): Promise<PointsResult> {
    const want = Math.floor(input.requested);
    if (want <= 0) return { pointsUsed: 0 };
    const userRepo = mgr.getRepository(User);
    const isPostgres = mgr.connection.options.type === 'postgres';
    const user = isPostgres
      ? await userRepo.findOne({
          where: { id: input.userId },
          lock: { mode: 'pessimistic_write' },
        })
      : await userRepo.findOne({ where: { id: input.userId } });
    if (!user) throw new BadRequestException('User not found');
    const balance = user.loyaltyPoints ?? 0;
    if (want > balance) {
      throw new BadRequestException('Insufficient loyalty points');
    }
    const pointsUsed = Math.min(want, Math.max(0, input.cap));
    user.loyaltyPoints = balance - pointsUsed;
    await userRepo.save(user);
    return { pointsUsed };
  }

  /**
   * Kembalikan poin (kompensasi Snap-gagal, pola MP-02). Idempotent
   * secukupnya: menambah kembali `pointsUsed` ke saldo user.
   */
  async refundPoints(
    mgr: EntityManager,
    input: { userId: string; pointsUsed: number },
  ): Promise<void> {
    if (!input.pointsUsed || input.pointsUsed <= 0) return;
    const userRepo = mgr.getRepository(User);
    const user = await userRepo.findOne({ where: { id: input.userId } });
    if (!user) return;
    user.loyaltyPoints = (user.loyaltyPoints ?? 0) + input.pointsUsed;
    await userRepo.save(user);
  }

  private async mustFind(id: string): Promise<Voucher> {
    const voucher = await this.vouchers.findOne({ where: { id } });
    if (!voucher) throw new NotFoundException('Voucher not found');
    return voucher;
  }

  /**
   * Terapkan field DTO ke entity + validasi silang (dipakai create & update).
   * `code` sudah ternormalisasi oleh pemanggil.
   */
  private buildVoucher(target: Voucher, dto: CreateVoucherDto, code: string): Voucher {
    const type = dto.type as VoucherType;
    if (type !== 'percent' && type !== 'fixed') {
      throw new BadRequestException('type must be percent or fixed');
    }
    assertValueRange(type, dto.value);
    if (dto.maxDiscount !== undefined && dto.maxDiscount < 0) {
      throw new BadRequestException('maxDiscount must be >= 0');
    }
    const validFrom = dto.validFrom ? new Date(dto.validFrom) : null;
    const validTo = dto.validTo ? new Date(dto.validTo) : null;
    assertPeriod(validFrom, validTo);
    const applicableTo = (dto.applicableTo ?? 'all') as VoucherScope;
    if (applicableTo !== 'booking' && applicableTo !== 'shop' && applicableTo !== 'all') {
      throw new BadRequestException('applicableTo must be booking, shop, or all');
    }

    target.code = code;
    target.type = type;
    target.value = dto.value;
    target.maxDiscount = dto.maxDiscount ?? null;
    target.minTransaction = dto.minTransaction ?? 0;
    target.quota = dto.quota ?? null;
    target.perUserLimit = dto.perUserLimit ?? null;
    target.validFrom = validFrom;
    target.validTo = validTo;
    target.applicableTo = applicableTo;
    target.active = dto.active ?? target.active ?? true;
    return target;
  }
}

/** Normalisasi kode: trim + uppercase (kolom `code` selalu uppercase). */
export function normalizeCode(raw: unknown): string {
  return String(raw ?? '').trim().toUpperCase();
}

/**
 * Hitung diskon rupiah (integer): percent = floor(subtotal*value/100)
 * capped maxDiscount; fixed = min(value, subtotal). Min 0.
 */
export function calcDiscount(
  voucher: { type: VoucherType; value: number; maxDiscount?: number | null },
  subtotal: number,
): number {
  if (subtotal <= 0) return 0;
  if (voucher.type === 'percent') {
    const raw = Math.floor((subtotal * voucher.value) / 100);
    const capped =
      voucher.maxDiscount != null ? Math.min(raw, voucher.maxDiscount) : raw;
    return Math.max(0, Math.min(capped, subtotal));
  }
  return Math.max(0, Math.min(voucher.value, subtotal));
}
/** Rentang nilai per tipe: percent 1..100, fixed >= 1. */
function assertValueRange(type: VoucherType, value: number): void {
  if (type === 'percent' && (value < 1 || value > 100)) {
    throw new BadRequestException('percent value must be 1..100');
  }
  if (type === 'fixed' && value < 1) {
    throw new BadRequestException('fixed value must be >= 1');
  }
}

/** Periode valid: tanggal valid + from tidak boleh setelah to. */
function assertPeriod(from: Date | null, to: Date | null): void {
  if (from && Number.isNaN(from.getTime())) {
    throw new BadRequestException('validFrom must be a valid date');
  }
  if (to && Number.isNaN(to.getTime())) {
    throw new BadRequestException('validTo must be a valid date');
  }
  if (from && to && from.getTime() > to.getTime()) {
    throw new BadRequestException('validFrom must not be after validTo');
  }
}

/** Mapping entity → response admin yang konsisten. */
function toItem(v: Voucher): VoucherItem {  return {
    id: v.id,
    code: v.code,
    type: v.type,
    value: v.value,
    maxDiscount: v.maxDiscount ?? null,
    minTransaction: v.minTransaction ?? 0,
    quota: v.quota ?? null,
    perUserLimit: v.perUserLimit ?? null,
    usedCount: v.usedCount ?? 0,
    validFrom: v.validFrom ? new Date(v.validFrom) : null,
    validTo: v.validTo ? new Date(v.validTo) : null,
    applicableTo: v.applicableTo,
    active: v.active,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
}
