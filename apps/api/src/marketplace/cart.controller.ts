import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CartService } from './cart.service';
import { UpdateCartDto } from './dto/cart.dto';

/**
 * Keranjang belanja (MP-02). Semua rute butuh JWT; cart selalu milik
 * current user (tidak ada akses silang user).
 */
@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cart: CartService) {}

  /** Cart aktif milik sendiri + total harga berjalan. */
  @Get()
  get(@CurrentUser() user: RequestUser) {
    return this.cart.get(user);
  }

  /**
   * Ubah cart: `{ productId, qty>0 }` tambah/ubah, `{ productId, qty: 0 }`
   * hapus baris, `{ clear: true }` kosongkan semua.
   * ST-05: `variantIndex?` (0-based) memilih varian — tiap (produk, varian)
   * adalah baris tersendiri; harga = dasar + priceDelta.
   */
  @Put()
  update(@CurrentUser() user: RequestUser, @Body() dto: UpdateCartDto) {
    return this.cart.update(user, dto);
  }
}
