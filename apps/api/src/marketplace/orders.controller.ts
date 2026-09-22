import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrdersService } from './orders.service';

/**
 * Checkout multiseller (MP-02): POST /checkout atomik dari cart milik
 * sendiri → 1 order + N grup seller + Snap Midtrans.
 * Cart kosong → 400; stok kurang / produk tak tersedia → 409.
 */
@Controller('checkout')
@UseGuards(JwtAuthGuard)
export class CheckoutController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @HttpCode(201)
  checkout(@CurrentUser() user: RequestUser) {
    return this.orders.checkout(user);
  }
}

/**
 * Riwayat order per seller (MP-02). Order selalu milik current user;
 * super_admin boleh melihat order siapa pun via GET /orders/:id.
 */
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  /** Daftar order milik sendiri, terbaru dulu. (Deklarasi sebelum `:id`.) */
  @Get('me')
  listMine(@CurrentUser() user: RequestUser) {
    return this.orders.listMine(user);
  }

  /** Detail order milik sendiri (403 bila milik orang lain). */
  @Get(':id')
  getOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.orders.getOne(id, user);
  }
}
