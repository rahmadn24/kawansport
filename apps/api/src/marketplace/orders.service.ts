import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { In, Repository } from 'typeorm';
import type { ActorInput } from '../auth/ownership';
import { MidtransService } from '../bookings/midtrans.service';
import { User } from '../users/user.entity';
import { VouchersService } from '../vouchers/vouchers.service';
import { Cart, CartItem } from './cart.entity';
import { CheckoutDto } from './dto/checkout.dto';
import { SellerDashboardQueryDto } from './dto/seller-dashboard-query.dto';
import { Product } from './product.entity';
import { Seller } from './seller.entity';
import {
  ShopOrder,
  ShopOrderGroup,
  ShopOrderItem,
  ShopOrderStatus,
} from './shop-order.entity';

export interface OrderDetailItem {
  productId: string;
  productName: string;
  qty: number;
  price: number;
  subtotal: number;
}

export interface OrderDetailGroup {
  id: string;
  sellerId: string;
  sellerShopName: string;
  subtotal: number;
  status: ShopOrderStatus;
  items: OrderDetailItem[];
}

export interface OrderDetail {
  id: string;
  userId: string;
  paymentRef: string;
  channel: string;
  status: ShopOrderStatus;
  total: number;
  /** Subtotal sebelum voucher/poin (ST-04; = total bila tanpa promo). */
  subtotal: number;
  /** Diskon voucher rupiah (ST-04, snapshot). */
  discount: number;
  /** Kode voucher terpakai (ST-04, snapshot, null bila tanpa voucher). */
  voucherCode: string | null;
  /** Poin Kawan terpakai (ST-04, snapshot, 1 poin = Rp1). */
  pointsUsed: number;
  snapToken: string | null;
  redirectUrl: string | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  groups: OrderDetailGroup[];
}

/**
 * Satu grup order dari sudut pandang seller (dashboard toko).
 * `status` selalu mengikuti order induk. Buyer HANYA terekspos via
 * `buyerDisplayName` — email/telepon TIDAK boleh bocor ke seller.
 */
export interface SellerOrderGroup {
  groupId: string;
  orderId: string;
  paymentRef: string;
  status: ShopOrderStatus;
  subtotal: number;
  sellerShopName: string;
  items: OrderDetailItem[];
  buyerDisplayName: string | null;
  paidAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(ShopOrder)
    private readonly orders: Repository<ShopOrder>,
    @InjectRepository(ShopOrderGroup)
    private readonly groups: Repository<ShopOrderGroup>,
    @InjectRepository(ShopOrderItem)
    private readonly orderItems: Repository<ShopOrderItem>,
    @InjectRepository(Cart)
    private readonly carts: Repository<Cart>,
    @InjectRepository(CartItem)
    private readonly cartItems: Repository<CartItem>,
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
    @InjectRepository(Seller)
    private readonly sellers: Repository<Seller>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly midtrans: MidtransService,
    private readonly vouchers: VouchersService,
  ) {}

  /**
   * Mutex in-process untuk critical section checkout (wajib untuk sqljs-test
   * yang tidak punya row-lock; di Postgres ada perlindungan tambahan
   * SELECT FOR UPDATE di dalam transaksi — pola yang sama dengan
   * SlotsService.withSlotLock di BK-02).
   */
  private readonly checkoutLocks = new Map<string, Promise<void>>();

  private async withCheckoutLock<T>(fn: () => Promise<T>): Promise<T> {
    const key = 'mp-checkout';
    const prev = this.checkoutLocks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const mine = new Promise<void>((res) => {
      release = res;
    });
    const tail = prev.then(() => mine);
    this.checkoutLocks.set(key, tail);
    await prev;
    try {
      return await fn();
    } finally {
      release();
      if (this.checkoutLocks.get(key) === tail) this.checkoutLocks.delete(key);
    }
  }

  /**
   * POST /checkout — checkout atomik cart milik sendiri:
   * lock produk (FOR UPDATE di Postgres) dalam urutan id stabil → cek
   * approved + stok → decrement → redeem voucher + potong poin (ST-04,
   * dalam transaksi yang sama) → buat 1 order + N grup (satu per seller) +
   * item snapshot → kosongkan cart → buat transaksi Snap Midtrans.
   * - Cart kosong → 400. Produk tak-approved/hilang/stok kurang → 409.
   * - Voucher invalid/kedaluwarsa/kuota habis → 400/409 (tanpa mutasi).
   * - Poin melebihi saldo → 400 (tanpa mutasi).
   * - 2 checkout paralel atas stok 1 → tepat 1 sukses (mutex + lock + cek).
   */
  async checkout(actor: ActorInput, dto?: CheckoutDto): Promise<OrderDetail> {
    const voucherCode = dto?.voucherCode?.trim() || null;
    const usePoints = dto?.usePoints ?? 0;
    const orderId = await this.withCheckoutLock(async () => {
      const created = await this.orders.manager.transaction(async (mgr) => {
        const cartRepo = mgr.getRepository(Cart);
        const itemRepo = mgr.getRepository(CartItem);
        const productRepo = mgr.getRepository(Product);
        const orderRepo = mgr.getRepository(ShopOrder);
        const groupRepo = mgr.getRepository(ShopOrderGroup);
        const orderItemRepo = mgr.getRepository(ShopOrderItem);

        const cart = await cartRepo.findOne({
          where: { userId: actor.id },
        });
        const lines = cart
          ? await itemRepo.find({
              where: { cartId: cart.id },
              order: { createdAt: 'ASC' },
            })
          : [];
        if (lines.length === 0) {
          throw new BadRequestException('Cart is empty');
        }

        const isPostgres = mgr.connection.options.type === 'postgres';
        // Kunci baris produk satu per satu dalam urutan id stabil agar dua
        // checkout paralel tidak deadlock (walau mutex sudah serialisasi
        // in-process, ini melindungi antar-proses di Postgres).
        const productIds = [...new Set(lines.map((l) => l.productId))].sort();
        const byId = new Map<string, Product>();
        for (const pid of productIds) {
          const row = isPostgres
            ? await productRepo.findOne({
                where: { id: pid },
                lock: { mode: 'pessimistic_write' },
              })
            : await productRepo.findOne({ where: { id: pid } });
          if (!row || row.status !== 'approved') {
            throw new ConflictException(
              'Product is no longer available for checkout',
            );
          }
          byId.set(pid, row);
        }

        for (const line of lines) {
          const p = byId.get(line.productId)!;
          if (p.stock < line.qty) {
            throw new ConflictException(
              `Insufficient stock for product ${p.name}`,
            );
          }
        }

        // Valid + cukup → decrement stok.
        for (const line of lines) {
          const p = byId.get(line.productId)!;
          p.stock -= line.qty;
          await productRepo.save(p);
        }

        // Kelompokkan per seller → 1 grup per seller.
        const sellerIds = [...new Set(lines.map((l) => byId.get(l.productId)!.sellerId))].sort();
        const paymentRef = generateMarketPaymentRef();
        const subtotal = lines.reduce(
          (sum, l) => sum + byId.get(l.productId)!.price * l.qty,
          0,
        );

        // ST-04: redeem voucher + potong poin dalam transaksi yang sama.
        // Urutan akuntansi: subtotal → diskon voucher → poin → total.
        let discount = 0;
        let appliedCode: string | null = null;
        let redemptionId: string | null = null;
        if (voucherCode) {
          const redeemed = await this.vouchers.redeemInTransaction(mgr, {
            code: voucherCode,
            userId: actor.id,
            subtotal,
            channel: 'shop',
          });
          discount = redeemed.discount;
          appliedCode = redeemed.voucherCode;
          redemptionId = redeemed.redemptionId;
        }
        const { pointsUsed } = await this.vouchers.deductPointsInTransaction(
          mgr,
          { userId: actor.id, requested: usePoints, cap: subtotal - discount },
        );
        const total = Math.max(0, subtotal - discount - pointsUsed);

        const order = await orderRepo.save(
          orderRepo.create({
            userId: actor.id,
            paymentRef,
            channel: 'marketplace',
            status: 'pending',
            total,
            subtotal,
            discount,
            voucherCode: appliedCode,
            pointsUsed,
          }),
        );
        if (redemptionId) {
          await this.vouchers.linkRedemption(mgr, {
            redemptionId,
            orderId: order.id,
          });
        }

        for (const sellerId of sellerIds) {
          const sellerLines = lines.filter(
            (l) => byId.get(l.productId)!.sellerId === sellerId,
          );
          const subtotal = sellerLines.reduce(
            (sum, l) => sum + byId.get(l.productId)!.price * l.qty,
            0,
          );
          const group = await groupRepo.save(
            groupRepo.create({
              orderId: order.id,
              sellerId,
              subtotal,
              status: 'pending',
            }),
          );
          for (const line of sellerLines) {
            const p = byId.get(line.productId)!;
            await orderItemRepo.save(
              orderItemRepo.create({
                orderId: order.id,
                groupId: group.id,
                productId: p.id,
                sellerId,
                productName: p.name,
                qty: line.qty,
                price: p.price,
                subtotal: p.price * line.qty,
              }),
            );
          }
        }

        // Cart dikosongkan (baris cart dipertahankan untuk belanja berikut).
        await itemRepo.delete({ cartId: cart!.id });
        return order.id;
      });
      return created;
    });

    // Snap dibuat SETELAH commit agar lock produk tidak ditahan selama
    // panggilan jaringan. Gagal Snap → kompensasi: stok dikembalikan +
    // order dibatalkan (pola yang sama dengan BK-03 yang melepas slot saat
    // gagal simpan/Snap). Mode stub tidak pernah gagal.
    try {
      const order = await this.orders.findOneOrFail({ where: { id: orderId } });
      const snap = await this.midtrans.createTransaction({
        orderId: order.paymentRef,
        grossAmount: order.total,
      });
      order.snapToken = snap.token;
      order.redirectUrl = snap.redirectUrl;
      await this.orders.save(order);
    } catch (err) {
      await this.compensateFailedSnap(orderId);
      throw err;
    }

    return this.mustLoad(orderId, actor);
  }

  /** GET /orders/me — daftar order milik sendiri (terbaru dulu). */
  async listMine(actor: ActorInput): Promise<{ data: OrderDetail[] }> {
    const rows = await this.orders.find({
      where: { userId: actor.id },
      order: { createdAt: 'DESC' },
    });
    const data: OrderDetail[] = [];
    for (const r of rows) data.push(await this.toDetail(r.id));
    return { data };
  }

  /**
   * GET /admin/orders — semua order untuk CMS (khusus super_admin,
   * read-only). Filter status opsional; sort createdAt DESC.
   */
  async listForAdmin(status?: string): Promise<{
    data: OrderDetail[];
    meta: { total: number };
  }> {
    const rows = await this.orders.find({
      order: { createdAt: 'DESC' },
    });
    const filtered = status ? rows.filter((o) => o.status === status) : rows;
    const data: OrderDetail[] = [];
    for (const r of filtered) data.push(await this.toDetail(r.id));
    return { data, meta: { total: filtered.length } };
  }

  /** GET /orders/:id — hanya pemilik / super_admin (selain itu 403). */
  async getOne(id: string, actor: ActorInput): Promise<OrderDetail> {
    const order = await this.orders.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    if (actor.role !== 'super_admin' && order.userId !== actor.id) {
      throw new ForbiddenException('Forbidden: not the order owner');
    }
    return this.toDetail(order.id);
  }

  /**
   * GET /orders/seller — daftar grup order milik toko sendiri (satu baris
   * per grup seller, terbaru dulu). Join order_groups milik seller saya +
   * order induknya. Tanpa profil seller → 404 jujur (bukan array kosong)
   * agar client bisa mengarahkan onboarding.
   */
  async listForSeller(
    actor: ActorInput,
    query: SellerDashboardQueryDto,
  ): Promise<{
    data: SellerOrderGroup[];
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
    const groups = await this.groups.find({
      where: { sellerId: seller.id },
      relations: { order: true, seller: true },
      order: { createdAt: 'DESC' },
    });
    const total = groups.length;
    const slice = groups.slice((page - 1) * limit, page * limit);
    const data: SellerOrderGroup[] = [];
    for (const g of slice) {
      const order = g.order;
      if (!order) continue;
      const items = await this.orderItems.find({
        where: { groupId: g.id },
        order: { createdAt: 'ASC' },
      });
      const buyer = await this.users.findOne({
        where: { id: order.userId },
      });
      data.push({
        groupId: g.id,
        orderId: order.id,
        paymentRef: order.paymentRef,
        status: order.status,
        subtotal: g.subtotal,
        sellerShopName: g.seller?.shopName ?? seller.shopName,
        items: items.map((it) => ({
          productId: it.productId,
          productName: it.productName,
          qty: it.qty,
          price: it.price,
          subtotal: it.subtotal,
        })),
        buyerDisplayName: buyer?.displayName ?? null,
        paidAt: order.paidAt ?? null,
        createdAt: g.createdAt,
      });
    }
    return { data, meta: { page, limit, total } };
  }

  /**
   * Kompensasi Snap gagal: kembalikan stok tiap item + batalkan redeem
   * voucher + kembalikan poin (ST-04) + tandai order `cancelled` (beserta
   * grupnya). Idempotent: hanya berjalan bila order masih `pending`
   * tanpa token.
   */
  private async compensateFailedSnap(orderId: string): Promise<void> {
    await this.orders.manager.transaction(async (mgr) => {
      const orderRepo = mgr.getRepository(ShopOrder);
      const groupRepo = mgr.getRepository(ShopOrderGroup);
      const orderItemRepo = mgr.getRepository(ShopOrderItem);
      const productRepo = mgr.getRepository(Product);

      const order = await orderRepo.findOne({ where: { id: orderId } });
      if (!order || order.status !== 'pending' || order.snapToken) return;

      const items = await orderItemRepo.find({ where: { orderId } });
      const qtyByProduct = new Map<string, number>();
      for (const it of items) {
        qtyByProduct.set(
          it.productId,
          (qtyByProduct.get(it.productId) ?? 0) + it.qty,
        );
      }
      const products = await productRepo.find({
        where: { id: In([...qtyByProduct.keys()]) },
      });
      for (const p of products) {
        p.stock += qtyByProduct.get(p.id) ?? 0;
        await productRepo.save(p);
      }
      if (order.voucherCode) {
        await this.vouchers.rollbackRedeem(mgr, {
          voucherCode: order.voucherCode,
          userId: order.userId,
          orderId,
        });
      }
      if ((order.pointsUsed ?? 0) > 0) {
        await this.vouchers.refundPoints(mgr, {
          userId: order.userId,
          pointsUsed: order.pointsUsed ?? 0,
        });
      }
      order.status = 'cancelled';
      await orderRepo.save(order);
      const groups = await groupRepo.find({ where: { orderId } });
      for (const g of groups) {
        g.status = 'cancelled';
        await groupRepo.save(g);
      }
    });
  }

  private async mustLoad(id: string, actor: ActorInput): Promise<OrderDetail> {
    const order = await this.orders.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    if (actor.role !== 'super_admin' && order.userId !== actor.id) {
      throw new ForbiddenException('Forbidden: not the order owner');
    }
    return this.toDetail(order.id);
  }

  private async toDetail(id: string): Promise<OrderDetail> {
    const order = await this.orders.findOneOrFail({ where: { id } });
    const groups = await this.groups.find({
      where: { orderId: id },
      relations: { seller: true },
      order: { createdAt: 'ASC' },
    });
    const items = await this.orderItems.find({ where: { orderId: id } });
    const byGroup = new Map<string, ShopOrderItem[]>();
    for (const it of items) {
      const list = byGroup.get(it.groupId) ?? [];
      list.push(it);
      byGroup.set(it.groupId, list);
    }
    return {
      id: order.id,
      userId: order.userId,
      paymentRef: order.paymentRef,
      channel: order.channel,
      status: order.status,
      total: order.total,
      subtotal: order.subtotal ?? order.total,
      discount: order.discount ?? 0,
      voucherCode: order.voucherCode ?? null,
      pointsUsed: order.pointsUsed ?? 0,
      snapToken: order.snapToken ?? null,
      redirectUrl: order.redirectUrl ?? null,
      paidAt: order.paidAt ?? null,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      groups: groups.map((g) => ({
        id: g.id,
        sellerId: g.sellerId,
        sellerShopName: g.seller?.shopName ?? '',
        subtotal: g.subtotal,
        status: g.status,
        items: (byGroup.get(g.id) ?? []).map((it) => ({
          productId: it.productId,
          productName: it.productName,
          qty: it.qty,
          price: it.price,
          subtotal: it.subtotal,
        })),
      })),
    };
  }
}

/** `payment_ref` marketplace = Midtrans `order_id` (unik, prefix "MP-"). */
export function generateMarketPaymentRef(): string {
  return `MP-${Date.now()}-${randomBytes(4).toString('hex')}`;
}
