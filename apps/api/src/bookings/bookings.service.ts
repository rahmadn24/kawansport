import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { DataSource, In, Repository } from 'typeorm';
import type { ActorInput } from '../auth/ownership';
import { EventParticipant } from '../events/event-participant.entity';
import { SportEvent } from '../events/event.entity';
import {
  ShopOrder,
  ShopOrderGroup,
  ShopOrderItem,
} from '../marketplace/shop-order.entity';
import { Product } from '../marketplace/product.entity';
import { Court } from '../venues/court.entity';
import {
  SLOT_DURATION_MINUTES,
  SlotsService,
  assertValidDate,
  generateSlotsForDate,
  parseHHMM,
} from '../venues/slots.service';
import { Booking, BookingStatus } from './booking.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { MidtransNotificationDto } from './dto/midtrans-notification.dto';
import { MidtransService } from './midtrans.service';

/** Booking pending kedaluwarsa 30 menit setelah dibuat (keputusan PO, BK-03). */
export const BOOKING_TTL_MS = 30 * 60 * 1000;

export interface BookingItem {
  id: string;
  userId: string;
  courtId: string;
  date: string;
  start: string;
  end: string;
  startMinute: number;
  endMinute: number;
  status: BookingStatus;
  paymentRef: string;
  amount: number;
  snapToken: string | null;
  redirectUrl: string | null;
  /** Id event asal (BK-04); null bila booking langsung via POST /bookings. */
  eventId: string | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Status booking yang masih menahan slot (confirmed di slot_claims). */
const ACTIVE_BOOKING_STATUSES: BookingStatus[] = ['pending', 'paid'];

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookings: Repository<Booking>,
    @InjectRepository(Court)
    private readonly courts: Repository<Court>,
    @InjectRepository(SportEvent)
    private readonly events: Repository<SportEvent>,
    @InjectRepository(EventParticipant)
    private readonly participants: Repository<EventParticipant>,
    private readonly slots: SlotsService,
    private readonly midtrans: MidtransService,
    // DataSource untuk cabang marketplace (MP-): repo ShopOrder/Product
    // diakses langsung agar tidak ada dependensi modul sirkular
    // Bookings <-> Marketplace (MidtransService dipakai ulang satu arah).
    private readonly dataSource: DataSource,
  ) {}

  /**
   * POST /bookings — buat booking pending + Snap transaction.
   * Slot langsung di-confirmed (anti-race via SlotsService.confirmSlot → 409
   * bila sudah booked/held orang lain); webhook/jobo expiry yang melepasnya.
   * Amount = snapshot `court.price_per_hour` prorata durasi.
   */
  async create(actor: ActorInput, dto: CreateBookingDto): Promise<BookingItem> {
    return this.createInternal(actor, dto, null);
  }

  /**
   * POST /events/:id/book (BK-04) — booking slot lapangan untuk event.
   * Pengaju boleh host ATAU peserta event (selain itu 403 — keputusan PO).
   * Validasi khusus event (sebelum alur booking standar):
   * - `date` wajib hari yang sama dengan datetime event (banding UTC) → 400.
   * - Event belum punya booking aktif (pending/paid) yang rentang waktunya
   *   bentrok di court+date yang sama → 409. Konflik slot fisik antar-event
   *   tetap ditolak 409 oleh SlotsService.confirmSlot di bawah.
   * Cancel mengikuti aturan BK-03 (POST /bookings/:id/cancel, hanya pending).
   */
  async createForEvent(
    actor: ActorInput,
    eventId: string,
    dto: CreateBookingDto,
  ): Promise<BookingItem> {
    const event = await this.events.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    const isHost = event.hostId === actor.id;
    const isParticipant = isHost
      ? true
      : await this.participants.exist({ where: { eventId, userId: actor.id } });
    if (!isParticipant) {
      throw new ForbiddenException('Only the host or participants can book for this event');
    }

    // Hari yang sama: bandingkan kalender UTC datetime event vs slot date.
    // (Offset asli request create tidak tersimpan; UTC deterministik & terdokumentasi.)
    const eventDay = new Date(event.datetime).toISOString().slice(0, 10);
    if (dto.date !== eventDay) {
      throw new BadRequestException(
        `Slot date must match the event day (${eventDay})`,
      );
    }

    const startMinute = resolveBookingStart(dto);
    const duration = dto.durationMinutes ?? SLOT_DURATION_MINUTES;
    const endMinute = startMinute + duration;

    const existing = await this.bookings.find({
      where: {
        eventId,
        courtId: dto.courtId,
        date: dto.date,
        status: In(ACTIVE_BOOKING_STATUSES),
      },
    });
    const clash = existing.find(
      (b) => startMinute < b.endMinute && b.startMinute < endMinute,
    );
    if (clash) {
      throw new ConflictException(
        'Event already has a booking overlapping this time',
      );
    }

    return this.createInternal(actor, dto, eventId);
  }

  /**
   * Daftar booking milik satu event (BK-04, untuk GET /events/:id).
   * Urut terbaru dulu; expiry oportunistik agar status tidak basi.
   */
  async listForEvent(eventId: string): Promise<{ data: BookingItem[] }> {
    await this.expireDueBookings();
    const rows = await this.bookings.find({
      where: { eventId },
      order: { createdAt: 'DESC' },
    });
    return { data: rows.map(toBookingItem) };
  }

  private async createInternal(
    actor: ActorInput,
    dto: CreateBookingDto,
    eventId: string | null,
  ): Promise<BookingItem> {
    assertValidDate(dto.date);
    const startMinute = resolveBookingStart(dto);
    const duration = dto.durationMinutes ?? SLOT_DURATION_MINUTES;
    const endMinute = startMinute + duration;
    if (endMinute > 24 * 60) {
      throw new BadRequestException('Slot exceeds 24:00');
    }

    const court = await this.courts.findOne({ where: { id: dto.courtId } });
    if (!court) throw new NotFoundException('Court not found');
    if (court.status !== 'active') {
      throw new ConflictException('Court is not active');
    }

    const generated = generateSlotsForDate(court.openHours, dto.date);
    const match = generated.find(
      (g) => g.startMinute === startMinute && g.endMinute === endMinute,
    );
    if (!match) {
      throw new BadRequestException(
        'Slot is outside court open hours for this date',
      );
    }

    // Cek oportunistik agar slot booking pending yang kedaluwarsa langsung
    // terbaca free sebelum klaim (cron 5 mnt sebagai jaring pengaman).
    await this.expireDueBookings();

    const amount = Math.round((court.pricePerHour * duration) / 60);
    const claim = await this.slots.confirmSlot(
      court.id,
      dto.date,
      startMinute,
      endMinute,
      actor.id,
    );

    const paymentRef = generatePaymentRef();
    try {
      const booking = await this.bookings.save(
        this.bookings.create({
          userId: actor.id,
          courtId: court.id,
          date: dto.date,
          startMinute,
          endMinute,
          status: 'pending',
          paymentRef,
          amount,
          slotClaimId: claim.id,
          eventId,
        }),
      );
      const snap = await this.midtrans.createTransaction({
        orderId: paymentRef,
        grossAmount: amount,
      });
      booking.snapToken = snap.token;
      booking.redirectUrl = snap.redirectUrl;
      return toBookingItem(await this.bookings.save(booking));
    } catch (err) {
      // Gagal simpan/Snap → bebaskan slot agar tidak nyangkut booked.
      await this.slots.releaseClaimInternal(claim.id).catch(() => undefined);
      throw err;
    }
  }

  /** GET /bookings/me — daftar booking milik sendiri (expiry oportunistik). */
  async listMine(actor: ActorInput): Promise<{ data: BookingItem[] }> {
    await this.expireDueBookings();
    const rows = await this.bookings.find({
      where: { userId: actor.id },
      order: { createdAt: 'DESC' },
    });
    return { data: rows.map(toBookingItem) };
  }

  /**
   * GET /admin/bookings — semua booking untuk CMS (khusus super_admin,
   * read-only). Filter status opsional; sort createdAt DESC.
   */
  async listForAdmin(status?: string): Promise<{
    data: BookingItem[];
    meta: { total: number };
  }> {
    await this.expireDueBookings();
    const rows = await this.bookings.find({
      order: { createdAt: 'DESC' },
    });
    const filtered = status ? rows.filter((b) => b.status === status) : rows;
    return {
      data: filtered.map(toBookingItem),
      meta: { total: filtered.length },
    };
  }

  /** GET /bookings/:id — hanya pemilik / super_admin (selain itu 403). */
  async getOne(id: string, actor: ActorInput): Promise<BookingItem> {
    await this.expireDueBookings();
    const booking = await this.bookings.findOne({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');
    assertMineOrAdmin(actor, booking.userId);
    return toBookingItem(booking);
  }

  /**
   * POST /bookings/:id/cancel — hanya pemilik / super_admin, hanya pending.
   * Cancel → slot released (bisa dibooking orang lain lagi).
   */
  async cancel(
    id: string,
    actor: ActorInput,
  ): Promise<{ ok: true; id: string; status: string }> {
    await this.expireDueBookings();
    const booking = await this.bookings.findOne({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');
    assertMineOrAdmin(actor, booking.userId);
    if (booking.status !== 'pending') {
      throw new ConflictException(
        `Only pending bookings can be cancelled (current: ${booking.status})`,
      );
    }
    booking.status = 'cancelled';
    await this.bookings.save(booking);
    if (booking.slotClaimId) {
      await this.slots.releaseClaimInternal(booking.slotClaimId);
    }
    return { ok: true, id: booking.id, status: 'cancelled' };
  }

  /**
   * POST /payments/midtrans/notification (publik, terverifikasi signature).
   * Routing kanal via prefix `order_id` (MP-02): "MP-" → order marketplace
   * (1 order + N grup seller), selain itu → booking BK-03 ("BK-").
   * Idempotent: hanya `pending` yang bisa berubah (double-hit aman).
   */
  async handleNotification(
    dto: MidtransNotificationDto,
  ): Promise<{ ok: true; status: string }> {
    const valid = this.midtrans.verifySignature({
      orderId: dto.order_id,
      statusCode: dto.status_code,
      grossAmount: dto.gross_amount,
      signatureKey: dto.signature_key,
    });
    if (!valid) {
      throw new ForbiddenException('Invalid Midtrans signature');
    }

    // Cabang marketplace (MP-02) — bedakan via prefix order_id.
    if (dto.order_id.startsWith('MP-')) {
      return this.handleMarketplaceNotification(dto);
    }

    const booking = await this.bookings.findOne({
      where: { paymentRef: dto.order_id },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'pending') {
      return { ok: true, status: booking.status };
    }
    // SEC-01 High: gross_amount wajib sama dengan amount booking — tolak
    // 409 (status tetap pending) bila beda agar paid palsu via nominal
    // kecil tidak mungkin.
    assertAmountMatches(dto.gross_amount, booking.amount);

    const tx = dto.transaction_status;
    const fraud = dto.fraud_status;

    if (tx === 'capture') {
      if (fraud === 'challenge') return { ok: true, status: 'pending' };
      if (fraud === 'deny') {
        await this.markTerminal(booking, 'cancelled');
        return { ok: true, status: 'cancelled' };
      }
      await this.markPaid(booking);
      return { ok: true, status: 'paid' };
    }
    if (tx === 'settlement') {
      await this.markPaid(booking);
      return { ok: true, status: 'paid' };
    }
    if (tx === 'pending') {
      return { ok: true, status: 'pending' };
    }
    if (tx === 'expire') {
      await this.markTerminal(booking, 'expired');
      return { ok: true, status: 'expired' };
    }
    if (tx === 'cancel' || tx === 'deny' || tx === 'failure') {
      await this.markTerminal(booking, 'cancelled');
      return { ok: true, status: 'cancelled' };
    }
    return { ok: true, status: 'pending' };
  }

  /**
   * Cabang webhook marketplace (MP-02) — `order_id` prefix "MP-".
   * Verifikasi signature sudah dilakukan pemanggil (sama dengan BK-03,
   * tanpa duplikasi). Idempotent: order non-pending dikembalikan apa adanya.
   * - settlement / capture(+accept) → order+grup `paid`
   * - capture+challenge → tetap pending; capture+deny → `cancelled`
   * - cancel / deny / failure → `cancelled` (+ rollback stok)
   * - expire → `expired` (+ rollback stok)
   * Rollback stok = kembalikan qty tiap item ke `products.stock`.
   */
  private async handleMarketplaceNotification(
    dto: MidtransNotificationDto,
  ): Promise<{ ok: true; status: string }> {
    const orderRepo = this.dataSource.getRepository(ShopOrder);
    const order = await orderRepo.findOne({
      where: { paymentRef: dto.order_id },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 'pending') {
      return { ok: true, status: order.status };
    }
    // SEC-01 High: sama seperti booking — gross_amount wajib sama dengan
    // order.total, beda -> 409 dan status tetap pending.
    assertAmountMatches(dto.gross_amount, order.total);

    const tx = dto.transaction_status;
    const fraud = dto.fraud_status;

    if (tx === 'capture') {
      if (fraud === 'challenge') return { ok: true, status: 'pending' };
      if (fraud === 'deny') {
        await this.markMarketTerminal(order.id, 'cancelled');
        return { ok: true, status: 'cancelled' };
      }
      await this.markMarketPaid(order.id);
      return { ok: true, status: 'paid' };
    }
    if (tx === 'settlement') {
      await this.markMarketPaid(order.id);
      return { ok: true, status: 'paid' };
    }
    if (tx === 'pending') {
      return { ok: true, status: 'pending' };
    }
    if (tx === 'expire') {
      await this.markMarketTerminal(order.id, 'expired');
      return { ok: true, status: 'expired' };
    }
    if (tx === 'cancel' || tx === 'deny' || tx === 'failure') {
      await this.markMarketTerminal(order.id, 'cancelled');
      return { ok: true, status: 'cancelled' };
    }
    return { ok: true, status: 'pending' };
  }

  private async markMarketPaid(orderId: string): Promise<void> {
    await this.dataSource.transaction(async (mgr) => {
      const orderRepo = mgr.getRepository(ShopOrder);
      const groupRepo = mgr.getRepository(ShopOrderGroup);
      const order = await orderRepo.findOneOrFail({ where: { id: orderId } });
      if (order.status !== 'pending') return;
      order.status = 'paid';
      order.paidAt = new Date();
      await orderRepo.save(order);
      const groups = await groupRepo.find({ where: { orderId } });
      for (const g of groups) {
        if (g.status === 'pending') {
          g.status = 'paid';
          await groupRepo.save(g);
        }
      }
    });
  }

  private async markMarketTerminal(
    orderId: string,
    status: 'expired' | 'cancelled',
  ): Promise<void> {
    await this.dataSource.transaction(async (mgr) => {
      const orderRepo = mgr.getRepository(ShopOrder);
      const groupRepo = mgr.getRepository(ShopOrderGroup);
      const itemRepo = mgr.getRepository(ShopOrderItem);
      const productRepo = mgr.getRepository(Product);
      const order = await orderRepo.findOneOrFail({ where: { id: orderId } });
      if (order.status !== 'pending') return;
      order.status = status;
      await orderRepo.save(order);
      const groups = await groupRepo.find({ where: { orderId } });
      for (const g of groups) {
        if (g.status === 'pending') {
          g.status = status;
          await groupRepo.save(g);
        }
      }
      // Rollback stok: kembalikan qty tiap item.
      const items = await itemRepo.find({ where: { orderId } });
      const qtyByProduct = new Map<string, number>();
      for (const it of items) {
        qtyByProduct.set(
          it.productId,
          (qtyByProduct.get(it.productId) ?? 0) + it.qty,
        );
      }
      if (qtyByProduct.size > 0) {
        const products = await productRepo.find({
          where: { id: In([...qtyByProduct.keys()]) },
        });
        for (const p of products) {
          p.stock += qtyByProduct.get(p.id) ?? 0;
          await productRepo.save(p);
        }
      }
    });
  }

  /**
   * Tandai semua booking pending yang berumur > 30 mnt sebagai expired +
   * bebaskan slotnya. Dipanggil cron tiap 5 mnt + oportunistik saat baca/tulis
   * booking. Mengembalikan jumlah yang di-expire (untuk log cron).
   */
  async expireDueBookings(): Promise<number> {
    const cutoff = Date.now() - BOOKING_TTL_MS;
    const pendings = await this.bookings.find({
      where: { status: 'pending' },
    });
    const due = pendings.filter(
      (b) => new Date(b.createdAt).getTime() <= cutoff,
    );
    for (const b of due) {
      b.status = 'expired';
      await this.bookings.save(b);
      if (b.slotClaimId) {
        await this.slots.releaseClaimInternal(b.slotClaimId);
      }
    }
    return due.length;
  }

  private async markPaid(booking: Booking): Promise<void> {
    booking.status = 'paid';
    booking.paidAt = new Date();
    await this.bookings.save(booking);
    if (booking.slotClaimId) {
      await this.slots.ensureConfirmedInternal(
        booking.slotClaimId,
        booking.userId,
      );
    }
  }

  private async markTerminal(
    booking: Booking,
    status: 'expired' | 'cancelled',
  ): Promise<void> {
    booking.status = status;
    await this.bookings.save(booking);
    if (booking.slotClaimId) {
      await this.slots.releaseClaimInternal(booking.slotClaimId);
    }
  }
}

/** `payment_ref` = Midtrans `order_id` (unik, ≤64 char). */
export function generatePaymentRef(): string {
  return `BK-${Date.now()}-${randomBytes(4).toString('hex')}`;
}

/**
 * Samakan nominal notifikasi dengan nominal tercatat (rupiah, integer).
 * Beda / bukan angka -> 409; pemanggil belum memutasi apa pun sehingga
 * status tetap pending.
 */
function assertAmountMatches(grossAmount: string, expected: number): void {
  if (Number(grossAmount) !== expected) {
    throw new ConflictException('Amount mismatch');
  }
}

function resolveBookingStart(dto: CreateBookingDto): number {
  if (dto.startMinute !== undefined) return dto.startMinute;
  if (dto.start !== undefined) return parseHHMM(dto.start);
  throw new BadRequestException('Either start or startMinute is required');
}

function assertMineOrAdmin(actor: ActorInput, ownerId: string): void {
  if (actor.role === 'super_admin') return;
  if (actor.id === ownerId) return;
  throw new ForbiddenException('Forbidden: not the booking owner');
}

function toHHMM(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function toBookingItem(b: Booking): BookingItem {
  return {
    id: b.id,
    userId: b.userId,
    courtId: b.courtId,
    date: b.date,
    start: toHHMM(b.startMinute),
    end: toHHMM(b.endMinute),
    startMinute: b.startMinute,
    endMinute: b.endMinute,
    status: b.status,
    paymentRef: b.paymentRef,
    amount: b.amount,
    snapToken: b.snapToken ?? null,
    redirectUrl: b.redirectUrl ?? null,
    eventId: b.eventId ?? null,
    paidAt: b.paidAt ?? null,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}
