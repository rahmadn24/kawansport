import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { ActorInput } from '../auth/ownership';
import { Cart, CartItem } from './cart.entity';
import { UpdateCartDto } from './dto/cart.dto';
import { Product } from './product.entity';

export interface CartLineItem {
  productId: string;
  qty: number;
  product: {
    id: string;
    sellerId: string;
    sellerShopName: string;
    name: string;
    price: number;
    stock: number;
    status: Product['status'];
  };
}

export interface CartView {
  items: CartLineItem[];
  total: number;
  count: number;
}

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart)
    private readonly carts: Repository<Cart>,
    @InjectRepository(CartItem)
    private readonly cartItems: Repository<CartItem>,
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
  ) {}

  /** GET /cart — cart aktif milik sendiri (kosong bila belum pernah isi). */
  async get(actor: ActorInput): Promise<CartView> {
    const cart = await this.getOrCreateCart(actor.id);
    return this.toView(cart.id);
  }

  /**
   * PUT /cart — add/update/remove/clear.
   * Produk harus ada + `approved` (selain itu 404 agar produk pending/
   * rejected/draft tidak bocor maupun bisa dibeli). Stok penuh dicek saat
   * checkout (bukan di sini) agar cart tetap bisa diisi dulu.
   */
  async update(actor: ActorInput, dto: UpdateCartDto): Promise<CartView> {
    if (dto.clear) {
      const cart = await this.getOrCreateCart(actor.id);
      await this.cartItems.delete({ cartId: cart.id });
      return this.toView(cart.id);
    }

    if (!dto.productId || dto.qty === undefined) {
      throw new BadRequestException(
        'Either { productId, qty } or { clear: true } is required',
      );
    }

    const product = await this.products.findOne({
      where: { id: dto.productId },
      relations: { seller: true },
    });
    if (!product || product.status !== 'approved') {
      throw new NotFoundException('Product not found');
    }

    const cart = await this.getOrCreateCart(actor.id);
    const existing = await this.cartItems.findOne({
      where: { cartId: cart.id, productId: product.id },
    });

    if (dto.qty === 0) {
      if (existing) await this.cartItems.remove(existing);
      return this.toView(cart.id);
    }

    if (existing) {
      existing.qty = dto.qty;
      await this.cartItems.save(existing);
    } else {
      await this.cartItems.save(
        this.cartItems.create({
          cartId: cart.id,
          productId: product.id,
          qty: dto.qty,
        }),
      );
    }
    return this.toView(cart.id);
  }

  private async getOrCreateCart(userId: string): Promise<Cart> {
    const existing = await this.carts.findOne({ where: { userId } });
    if (existing) return existing;
    try {
      return await this.carts.save(this.carts.create({ userId }));
    } catch {
      // Balapan pembuatan cart perdana (unique user_id) → baca ulang.
      const raced = await this.carts.findOne({ where: { userId } });
      if (!raced) throw new BadRequestException('Failed to open cart');
      return raced;
    }
  }

  private async toView(cartId: string): Promise<CartView> {
    const rows = await this.cartItems.find({
      where: { cartId },
      relations: { product: { seller: true } },
      order: { createdAt: 'ASC' },
    });
    const items: CartLineItem[] = rows.map((r) => ({
      productId: r.productId,
      qty: r.qty,
      product: {
        id: r.product?.id ?? r.productId,
        sellerId: r.product?.sellerId ?? '',
        sellerShopName: r.product?.seller?.shopName ?? '',
        name: r.product?.name ?? '',
        price: r.product?.price ?? 0,
        stock: r.product?.stock ?? 0,
        status: r.product?.status ?? 'approved',
      },
    }));
    const total = items.reduce((sum, i) => sum + i.product.price * i.qty, 0);
    const count = items.reduce((sum, i) => sum + i.qty, 0);
    return { items, total, count };
  }
}
