import {
  Body,
  Controller,
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

  /** Slot per tanggal dari open_hours + status free/held/booked. */
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
}
