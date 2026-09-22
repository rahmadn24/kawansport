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
import { BookingsService } from '../bookings/bookings.service';
import { CreateEventDto } from './dto/create-event.dto';
import { BookEventDto } from './dto/book-event.dto';
import { ListEventsDto } from './dto/list-events.dto';
import { EventsService } from './events.service';

@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(
    private readonly events: EventsService,
    private readonly bookings: BookingsService,
  ) {}

  /**
   * Buat event (SM-04 + SM-05). Host otomatis = user dari JWT dan langsung
   * tercatat sebagai peserta pertama (participants_count=1).
   */
  @Post()
  create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateEventDto,
  ) {
    return this.events.create(user.id, dto);
  }

  /** Daftar event: filter sport + rentang datetime + radius geo, sort datetime ASC. */
  @Get()
  list(@Query() query: ListEventsDto) {
    return this.events.list(query);
  }

  /** Detail event + info host + isJoined milik current user (SM-05: real). */
  @Get(':id')
  detail(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.detailWithBooking(id, user.id);
  }

  /** Daftar peserta event (SM-05), urut waktu join. */
  @Get(':id/participants')
  participants(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.events.participants(id);
  }

  /**
   * Ikut event (SM-05). Sukses -> 201. Double-join / penuh -> 409.
   * Transaksional anti-race (SELECT FOR UPDATE + unique pair + mutex).
   */
  @Post(':id/join')
  join(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.events.join(id, user.id);
  }

  /** Keluar event (SM-05). Sukses -> 200. Bukan peserta -> 404. */
  @Post(':id/leave')
  @HttpCode(200)
  leave(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.events.leave(id, user.id);
  }

  /**
   * Booking lapangan untuk event (BK-04). Host atau peserta boleh mengajukan
   * (selain itu 403); tanggal slot wajib hari yang sama dengan datetime event
   * (400 bila beda); bentrok jam dengan booking aktif event yang sama → 409.
   * Sukses -> 201 booking pending + Snap token (aturan cancel = BK-03).
   */
  @Post(':id/book')
  book(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: BookEventDto,
  ) {
    return this.bookings.createForEvent(user, id, dto);
  }

  /**
   * Detail + booking info (BK-04): `bookings` = semua booking event ini
   * (court, slot, status + Snap info), `booking` = yang paling relevan
   * (pending/paid terbaru, else terbaru) atau null bila belum ada.
   */
  private async detailWithBooking(id: string, userId: string) {
    const [detail, { data: bookings }] = await Promise.all([
      this.events.detail(id, userId),
      this.bookings.listForEvent(id),
    ]);
    const active = bookings.find(
      (b) => b.status === 'pending' || b.status === 'paid',
    );
    return { ...detail, booking: active ?? bookings[0] ?? null, bookings };
  }
}
