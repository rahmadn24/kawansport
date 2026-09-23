import {
  Body,
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
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CreateWalkInDto } from './dto/create-walk-in.dto';

/** Booking lapangan + pembayaran (BK-03) + walk-in (API-W06) + check-in (API-W07). Semua rute butuh JWT. */
@Controller('bookings')
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  /** Buat booking pending (slot langsung confirmed, Snap token dikembalikan). */
  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateBookingDto) {
    return this.bookings.create(user, dto);
  }

  /**
   * Walk-in owner (API-W06): langsung `paid` tanpa Midtrans.
   * Guard service: owner venue court tsb / super_admin (lintas owner → 403).
   */
  @Post('walk-in')
  @HttpCode(201)
  createWalkIn(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateWalkInDto,
  ) {
    return this.bookings.createWalkIn(user, dto);
  }

  /** Daftar booking milik sendiri. (Deklarasi sebelum `:id` agar tidak bentrok.) */
  @Get('me')
  listMine(@CurrentUser() user: RequestUser) {
    return this.bookings.listMine(user);
  }

  /**
   * Lookup via kode check-in (API-W07, untuk kasir owner).
   * Lintas owner / kode tak dikenal → 404 (tanpa bocor).
   */
  @Get('by-code/:code')
  getByCode(
    @Param('code') code: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.bookings.getByCode(code, user);
  }

  /** Detail booking milik sendiri (403 bila milik orang lain). */
  @Get(':id')
  getOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.bookings.getOne(id, user);
  }

  /** Batalkan booking pending milik sendiri (slot dibebaskan). */
  @Post(':id/cancel')
  @HttpCode(200)
  cancel(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.bookings.cancel(id, user);
  }

  /**
   * Check-in kehadiran (API-W07, sekali saja → 409 bila ulang).
   * Guard service: owner venue booking tsb / super_admin (lintas owner → 404).
   */
  @Post(':id/check-in')
  @HttpCode(200)
  checkIn(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.bookings.checkIn(id, user);
  }
}
