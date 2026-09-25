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
import { Product, ProductBadge, ProductVariant } from './product.entity';
import {
  assertValidVariantIndex,
  effectiveStockFor,
  unitPriceFor,
  variantNameFor,
} from './product-variants';

export interface CartLineItem {
  productId: string;
  qty: number;
  /** ST-05: indeks varian (-1 = tanpa varian). */
  variantIndex: number;
  /** ST-05: snapshot nama varian (null bila tanpa varian). */
  variantName: string | null;
  product: {
    id: string;
    sellerId: string;
    sellerShopName: string;
    /** ST-05: toko terverifikasi admin. */
    sellerVerified: boolean;
    name: string;
    /** ST-05: harga SATUAN sudah termasuk priceDelta varian. */
    price: number;
    /** ST-05: stok efektif (stok varian bila ada, else stok dasar). */
    stock: number;
    status: Product['status'];
    /** ST-05: badge kurasi manual seller (null = tanpa badge). */
    badge: ProductBadge | null;
    /** ST-05: daftar varian produk (untuk picker katalog). */
    variants: ProductVariant[];
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
   * ST-05: `variantIndex` (0-based, absen = tanpa varian) memilih varian;
   * tiap (produk, varian) adalah baris tersendiri. Indeks invalid → 400.
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

    const variantIndex = dto.variantIndex ?? -1;
    assertValidVariantIndex(product, variantIndex);

    const cart = await this.getOrCreateCart(actor.id);
    const existing = await this.cartItems.findOne({
      where: { cartId: cart.id, productId: product.id, variantIndex },
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
          variantIndex,
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
    const items: CartLineItem[] = rows.map((r) => {
      const p = r.product;
      const vIdx = r.variantIndex ?? -1;
      return {
        productId: r.productId,
        qty: r.qty,
        variantIndex: vIdx,
        variantName: p ? variantNameFor(p, vIdx) : null,
        product: {
          id: r.product?.id ?? r.productId,
          sellerId: r.product?.sellerId ?? '',
          sellerShopName: r.product?.seller?.shopName ?? '',
          sellerVerified: r.product?.seller?.verified ?? false,
          name: r.product?.name ?? '',
          price: p ? unitPriceFor(p, vIdx) : 0,
          stock: p ? effectiveStockFor(p, vIdx) : 0,
          status: r.product?.status ?? 'approved',
          badge: r.product?.badge ?? null,
          variants: r.product?.variants ?? [],
        },
      };
    });
    const total = items.reduce((sum, i) => sum + i.product.price * i.qty, 0);
    const count = items.reduce((sum, i) => sum + i.qty, 0);
    return { items, total, count };
  }
}
