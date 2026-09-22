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

/** Booking lapangan + pembayaran (BK-03). Semua rute butuh JWT. */
@Controller('bookings')
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  /** Buat booking pending (slot langsung confirmed, Snap token dikembalikan). */
  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateBookingDto) {
    return this.bookings.create(user, dto);
  }

  /** Daftar booking milik sendiri. (Deklarasi sebelum `:id` agar tidak bentrok.) */
  @Get('me')
  listMine(@CurrentUser() user: RequestUser) {
    return this.bookings.listMine(user);
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
}
