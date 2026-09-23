import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { CreateBlockDto } from './dto/create-block.dto';
import { HoldSlotDto } from './dto/hold-slot.dto';
import { SlotsService } from './slots.service';

/**
 * Slot availability real-time anti-race (BK-02).
 * Rute court-level di sini (prefix `courts`) agar tidak bentrok dengan
 * `VenuesController` (prefix `venues`); release di prefix `holds`.
 */
@Controller()
export class SlotsController {
  constructor(private readonly slots: SlotsService) {}

  /** Slot per tanggal dari open_hours + status free/held/booked/blocked. */
  @Get('courts/:id/availability')
  @UseGuards(JwtAuthGuard)
  availability(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: AvailabilityQueryDto,
  ) {
    return this.slots.availability(id, query.date);
  }

  /** Klaim satu slot (hold 10 menit), transaksional anti-race. */
  @Post('courts/:id/hold')
  @UseGuards(JwtAuthGuard)
  hold(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: HoldSlotDto,
  ) {
    return this.slots.hold(id, user, dto);
  }

  /** Lepas hold milik sendiri (idempotent). */
  @Post('holds/:id/release')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  release(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.slots.release(id, user);
  }

  /**
   * Blokir slot (API-W06, owner venue / super_admin — 403 lintas owner).
   * Menutup slot di availability sebagai `blocked` + menolak hold/booking.
   */
  @Post('courts/:id/blocks')
  @UseGuards(JwtAuthGuard)
  createBlock(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateBlockDto,
  ) {
    return this.slots.createBlock(id, user, dto);
  }

  /** Daftar blokir satu court (owner venue / super_admin), filter `date?`. */
  @Get('courts/:id/blocks')
  @UseGuards(JwtAuthGuard)
  listBlocks(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: RequestUser,
    @Query('date') date?: string,
  ) {
    return this.slots.listBlocks(id, user, date);
  }

  /** Buka blokir (owner venue / super_admin). Blokir tak ada → 404. */
  @Delete('courts/:id/blocks/:blockId')
  @UseGuards(JwtAuthGuard)
  deleteBlock(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('blockId', new ParseUUIDPipe()) blockId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.slots.deleteBlock(id, blockId, user);
  }
}
