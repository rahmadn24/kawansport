import {
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { assertOwnerOrAdmin, type ActorInput } from '../auth/ownership';
import { assertPhotoUrls } from '../uploads/photo-url';
import { normalizePhotos } from '../venues/venues.service';
import { MidtransService } from '../bookings/midtrans.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateEventDto } from './dto/create-event.dto';
import { ListEventsDto } from './dto/list-events.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventParticipant } from './event-participant.entity';
import { EventPayment } from './event-payment.entity';
import { EventWaitlist } from './event-waitlist.entity';
import { SportEvent, resolveEventStatus } from './event.entity';

const DEFAULT_RADIUS_M = 10000;

/** Batas foto event (ST-01). */
export const MAX_EVENT_PHOTOS = 5;

/**
 * TTL payment pending join event berbayar (ST-02) — sama dengan
 * `BOOKING_TTL_MS` (keputusan PO BK-03): 30 menit. Ditegakkan oportunistik
 * di `join` (tidak ada cron khusus; webhook expire/cancel juga menutupnya).
 */
export const EVENT_PAYMENT_TTL_MS = 30 * 60 * 1000;

export interface EventListItem {
  id: string;
  sport: string;
  title: string;
  description: string | null;
  datetime: Date;
  lat: number;
  lng: number;
  capacity: number;
  /** Iuran join rupiah, IDR only (ST-02, 0 = gratis). */
  fee: number;
  participantsCount: number;
  status: 'open' | 'full';
  photos: string[];
  host: { id: string; email: string; displayName: string | null; avatarUrl: string | null };
  /** Meter dari titik query; hanya ada saat filter lat/lng dipakai. */
  distanceMeters?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventParticipantItem {
  userId: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  joinedAt: Date;
}

/** Info pembayaran join event berbayar (ST-02) untuk response join. */
export interface EventPaymentItem {
  id: string;
  eventId: string;
  userId: string;
  amount: number;
  status: string;
  paymentRef: string;
  snapToken: string | null;
  redirectUrl: string | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Hasil join: event + flag peserta + payment (hanya event berbayar). */
export type JoinResult = EventListItem & {
  isJoined: boolean;
  payment?: EventPaymentItem;
};

/** Item antrean untuk response waitlist (ST-03). */
export interface WaitlistItem {
  userId: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  position: number;
  status: string;
  createdAt: Date;
}

@Injectable()
export class EventsService implements OnModuleInit {
  constructor(
    @InjectRepository(SportEvent)
    private readonly events: Repository<SportEvent>,
    @InjectRepository(EventParticipant)
    private readonly participantRows: Repository<EventParticipant>,
    @InjectRepository(EventPayment)
    private readonly paymentRows: Repository<EventPayment>,
    @InjectRepository(EventWaitlist)
    private readonly waitlistRows: Repository<EventWaitlist>,
    private readonly users: UsersService,
    private readonly midtrans: MidtransService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Mutex per-event (in-process). Join/leave yang datang bersamaan ke event
   * yang sama diserialkan di sini; di Postgres ada perlindungan tambahan
   * SELECT FOR UPDATE di dalam transaksi sehingga aman antar-proses juga.
   */
  private readonly eventLocks = new Map<string, Promise<void>>();

  private async withEventLock<T>(eventId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.eventLocks.get(eventId) ?? Promise.resolve();
    let release!: () => void;
    const mine = new Promise<void>((res) => {
      release = res;
    });
    const tail = prev.then(() => mine);
    this.eventLocks.set(eventId, tail);
    await prev;
    try {
      return await fn();
    } finally {
      release();
      if (this.eventLocks.get(eventId) === tail) this.eventLocks.delete(eventId);
    }
  }

  /** Buat extension PostGIS + GIST index (postgres saja, idempotent). */
  async onModuleInit() {
    if (this.events.manager.connection.options.type !== 'postgres') return;
    try {
      await this.events.query('CREATE EXTENSION IF NOT EXISTS postgis');
    } catch {
      // Kurang hak / sudah ada — index di bawah tetap dicoba.
    }
    try {
      await this.events.query(
        'CREATE INDEX IF NOT EXISTS idx_events_location_gist ON events USING GIST (location)',
      );
    } catch {
      // Index spasial gagal dibuat — tidak fatal.
    }
    try {
      await this.events.query(
        'CREATE INDEX IF NOT EXISTS idx_events_datetime ON events (datetime)',
      );
    } catch {
      // Index waktu gagal dibuat — tidak fatal.
    }
  }

  private get isPostgres(): boolean {
    return this.events.manager.connection.options.type === 'postgres';
  }

  /** POST /events — host = current user; host otomatis jadi peserta #1 (SM-05). */
  async create(hostId: string, dto: CreateEventDto): Promise<EventListItem> {
    const host = await this.users.findById(hostId);
    if (!host) throw new NotFoundException('Host not found');

    const event = this.events.create({
      hostId,
      sport: dto.sport.trim(),
      title: dto.title.trim(),
      description: dto.description?.trim() ? dto.description.trim() : null,
      datetime: new Date(dto.datetime),
      lat: dto.lat,
      lng: dto.lng,
      capacity: dto.capacity,
      fee: dto.fee ?? 0,
      participantsCount: 1,
      status: resolveEventStatus(1, dto.capacity),
      photos: validateEventPhotos(normalizePhotos(dto.photos ?? [])),
    });
    const saved = await this.events.save(event);
    await this.participantRows.save(
      this.participantRows.create({ eventId: saved.id, userId: hostId }),
    );
    await this.syncLocation(saved.id, saved.lat, saved.lng);
    const fresh = await this.events.findOne({
      where: { id: saved.id },
      relations: { host: true },
    });
    return this.toPublic(fresh ?? { ...saved, host });
  }

  /**
   * GET /events — filter sport + rentang datetime + lingkaran geo,
   * sort datetime ASC, pagination page/limit.
   */
  async list(query: ListEventsDto): Promise<{
    data: EventListItem[];
    meta: { page: number; limit: number; total: number };
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const useGeo = query.lat !== undefined && query.lng !== undefined;
    const radius = query.radius ?? DEFAULT_RADIUS_M;

    if (this.isPostgres) {
      return this.listPostgres(query, page, limit, useGeo, radius);
    }
    return this.listSqljs(query, page, limit, useGeo, radius);
  }

  private async listPostgres(
    query: ListEventsDto,
    page: number,
    limit: number,
    useGeo: boolean,
    radius: number,
  ): Promise<{ data: EventListItem[]; meta: { page: number; limit: number; total: number } }> {
    const qb = this.events
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.host', 'host')
      .orderBy('e.datetime', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.sport?.trim()) {
      qb.andWhere('LOWER(e.sport) = LOWER(:sport)', { sport: query.sport.trim() });
    }
    if (query.from) {
      qb.andWhere('e.datetime >= :from', { from: new Date(query.from) });
    }
    if (query.to) {
      qb.andWhere('e.datetime <= :to', { to: new Date(query.to) });
    }
    if (useGeo) {
      qb.andWhere(
        'ST_DWithin(e.location, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :radius)',
        { lat: query.lat, lng: query.lng, radius },
      );
      qb.addSelect(
        'ST_Distance(e.location, ST_SetSRID(ST_MakePoint(:lngQ, :latQ), 4326)::geography)',
        'distanceMeters',
      ).setParameters({ latQ: query.lat, lngQ: query.lng });
    }

    const [rows, total] = await qb.getManyAndCount();
    // Ambil jarak bila geo dipakai (getRawMany sejajar urutan getMany).
    let distances: Array<number | null> = [];
    if (useGeo) {
      const raw = await qb.getRawMany<{ distanceMeters: string }>();
      distances = raw.map((r) => (r.distanceMeters == null ? null : Number(r.distanceMeters)));
    }
    return {
      data: rows.map((e, i) =>
        this.toPublic(e, useGeo && distances[i] != null ? Math.round(distances[i] as number) : undefined),
      ),
      meta: { page, limit, total },
    };
  }

  /** Fallback sqljs (e2e tanpa Postgres): filter + sort di memori. */
  private async listSqljs(
    query: ListEventsDto,
    page: number,
    limit: number,
    useGeo: boolean,
    radius: number,
  ): Promise<{ data: EventListItem[]; meta: { page: number; limit: number; total: number } }> {
    const rows = await this.events.find({
      relations: { host: true },
      order: { datetime: 'ASC' },
    });
    const sport = query.sport?.trim().toLowerCase();
    const from = query.from ? new Date(query.from).getTime() : null;
    const to = query.to ? new Date(query.to).getTime() : null;

    const filtered = rows.filter((e) => {
      if (sport && e.sport.toLowerCase() !== sport) return false;
      const t = new Date(e.datetime).getTime();
      if (from != null && t < from) return false;
      if (to != null && t > to) return false;
      if (useGeo) {
        const d = haversineMeters(query.lat as number, query.lng as number, e.lat, e.lng);
        if (d > radius) return false;
      }
      return true;
    });

    const total = filtered.length;
    const slice = filtered.slice((page - 1) * limit, page * limit);
    return {
      data: slice.map((e) =>
        this.toPublic(
          e,
          useGeo
            ? Math.round(haversineMeters(query.lat as number, query.lng as number, e.lat, e.lng))
            : undefined,
        ),
      ),
      meta: { page, limit, total },
    };
  }

  /** PATCH /events/:id — host (atau super_admin) ubah title/deskripsi/foto. */
  async update(
    id: string,
    actor: ActorInput,
    dto: UpdateEventDto,
  ): Promise<EventListItem & { isJoined: boolean }> {
    const event = await this.events.findOne({
      where: { id },
      relations: { host: true },
    });
    if (!event) throw new NotFoundException('Event not found');
    assertOwnerOrAdmin(actor, event.hostId);
    if (dto.title !== undefined) event.title = dto.title.trim();
    if (dto.description !== undefined) {
      event.description = dto.description?.trim() ? dto.description.trim() : null;
    }
    if (dto.photos !== undefined) {
      event.photos = validateEventPhotos(normalizePhotos(dto.photos));
    }
    if (dto.fee !== undefined) event.fee = dto.fee;
    const saved = await this.events.save(event);
    const fresh = await this.events.findOne({
      where: { id: saved.id },
      relations: { host: true },
    });
    const row = fresh ?? saved;
    const isJoined = await this.participantRows.exist({
      where: { eventId: id, userId: actor.id },
    });
    return { ...this.toPublic(row), isJoined };
  }

  /** GET /events/:id — detail + host info + isJoined real (SM-05). */
  async detail(
    id: string,
    userId?: string,
  ): Promise<EventListItem & { isJoined: boolean }> {
    const event = await this.events.findOne({
      where: { id },
      relations: { host: true },
    });
    if (!event) throw new NotFoundException('Event not found');
    const isJoined = userId
      ? await this.participantRows.exist({ where: { eventId: id, userId } })
      : false;
    return { ...this.toPublic(event), isJoined };
  }

  /**
   * POST /events/:id/join (SM-05 + ST-02 + ST-03) — transaksional anti-race:
   * kunci baris event (SELECT FOR UPDATE di Postgres), tolak double-join 409.
   *
   * - Event GRATIS (`fee=0`): seperti SM-05 — langsung jadi peserta.
   *   Event penuh → 409 `{ waitlisted: true, position }` + otomatis masuk
   *   antrean ST-03 (duplikat antrean → 409).
   * - Event BERBAYAR (`fee>0`): TIDAK langsung jadi peserta. Dibuat/dipakai
   *   ulang `EventPayment` pending + Snap token → 201 `{ isJoined: false,
   *   payment }`. Peserta dicatat HANYA saat webhook settlement (paid).
   *   Payment pending TIDAK makan slot (keputusan ST-02); slot dicek dari
   *   jumlah peserta berbayar. Event penuh (paid penuh) → jalur waitlist
   *   yang sama seperti event gratis (tidak dibuatkan payment).
   * - Join ulang saat masih ada pending aktif → 201 dengan payment yang sama
   *   (idempotent, tanpa Snap baru).
   */
  async join(eventId: string, userId: string): Promise<JoinResult> {
    try {
      return await this.withEventLock(eventId, () =>
        this.events.manager.transaction(async (mgr) => {
        const eventRepo = mgr.getRepository(SportEvent);
        const partRepo = mgr.getRepository(EventParticipant);
        const payRepo = mgr.getRepository(EventPayment);
        const waitRepo = mgr.getRepository(EventWaitlist);

        const event = this.isPostgres
          ? await eventRepo.findOne({
              where: { id: eventId },
              lock: { mode: 'pessimistic_write' },
            })
          : await eventRepo.findOne({ where: { id: eventId } });
        if (!event) throw new NotFoundException('Event not found');

        const existing = await partRepo.findOne({ where: { eventId, userId } });
        if (existing) throw new ConflictException('Already joined');

        const count = await partRepo.count({ where: { eventId } });
        const fee = event.fee ?? 0;

        // Event penuh (gratis maupun berbayar-yang-sudah-paid-penuh):
        // otomatis masuk antrean ST-03 + 409 { waitlisted: true, position }.
        // CATATAN: baris waitlist TIDAK ditulis di dalam transaksi ini —
        // throw setelah save me-rollback insert. Posisi dilempar sebagai
        // sinyal, ditulis setelah commit oleh catch di bawah, baru 409.
        if (count >= event.capacity) {
          const waitlisted = await waitRepo.findOne({
            where: { eventId, userId },
          });
          if (waitlisted) {
            throw new ConflictException('Already waitlisted');
          }
          const position = (await waitRepo.count({ where: { eventId } })) + 1;
          throw new EventFullSignal(position);
        }

        // Event gratis: jalur SM-05 seperti semula.
        if (fee <= 0) {
          try {
            await partRepo.save(partRepo.create({ eventId, userId }));
          } catch {
            // Balapan antar-proses lolos dari cek di atas: unique pair melarang
            // duplikat; baca ulang untuk pesan error yang tepat.
            const raced = await partRepo.findOne({ where: { eventId, userId } });
            if (raced) throw new ConflictException('Already joined');
            const recount = await partRepo.count({ where: { eventId } });
            if (recount >= event.capacity) {
              throw new ConflictException('Event is full');
            }
            throw new ConflictException('Already joined');
          }

          event.participantsCount = count + 1;
          event.status = resolveEventStatus(count + 1, event.capacity);
          await eventRepo.save(event);
          const fresh = await eventRepo.findOne({
            where: { id: eventId },
            relations: { host: true },
          });
          return { ...this.toPublic(fresh ?? event), isJoined: true };
        }

        // Event berbayar: pakai ulang pending aktif yang masih berlaku
        // (oportunistik: yang kedaluwarsa ditandai expired dulu).
        await this.expireDueEventPayments(payRepo, eventId);
        const pending = await payRepo.find({
          where: { eventId, userId, status: 'pending' },
          order: { createdAt: 'DESC' },
        });
        if (pending.length > 0) {
          const withHost = await eventRepo.findOne({
            where: { id: eventId },
            relations: { host: true },
          });
          return {
            ...this.toPublic(withHost ?? event),
            isJoined: false,
            payment: toEventPaymentItem(pending[0]),
          };
        }

        const paymentRef = generateEventPaymentRef();
        const payment = await payRepo.save(
          payRepo.create({
            eventId,
            userId,
            amount: fee,
            status: 'pending',
            paymentRef,
          }),
        );
        // Snap dibuat SETELAH baris tersimpan (pola BK-03: tanpa network di
        // mode stub; transaksi tidak menahan lock selama panggilan jaringan —
        // di Postgres lock dilepas saat commit di akhir blok ini).
        const snap = await this.midtrans.createTransaction({
          orderId: paymentRef,
          grossAmount: fee,
        });
        payment.snapToken = snap.token;
        payment.redirectUrl = snap.redirectUrl;
        const saved = await payRepo.save(payment);
        const withHost = await eventRepo.findOne({
          where: { id: eventId },
          relations: { host: true },
        });
        return {
          ...this.toPublic(withHost ?? event),
          isJoined: false,
          payment: toEventPaymentItem(saved),
        };
        }),
      );
    } catch (err) {
      // Event penuh: tulis baris waitlist SETELAH commit (di dalam transaksi
      // throw = rollback). Balapan duplikat antar-proses diamankan unique
      // pair (event_id, user_id) → 409 'Already waitlisted'.
      if (err instanceof EventFullSignal) {
        try {
          await this.waitlistRows.save(
            this.waitlistRows.create({
              eventId,
              userId,
              position: err.position,
              status: 'waiting',
            }),
          );
        } catch (saveErr) {
          if (isUniqueViolation(saveErr)) {
            throw new ConflictException('Already waitlisted');
          }
          throw saveErr;
        }
        throw waitlistedError(err.position);
      }
      throw err;
    }
  }

  /**
   * POST /events/:id/leave (SM-05 + ST-03) — transaksional: hapus peserta,
   * hitung ulang count + status open/full atomik. Bukan peserta -> 404.
   * Setelah slot kosong, antrean terdepan otomatis dipromosi jadi `invited`
   * + notifikasi best-effort (ST-03).
   */
  async leave(
    eventId: string,
    userId: string,
  ): Promise<EventListItem & { isJoined: boolean }> {
    const result = await this.withEventLock(eventId, () =>
      this.events.manager.transaction(async (mgr) => {
        const eventRepo = mgr.getRepository(SportEvent);
        const partRepo = mgr.getRepository(EventParticipant);

        const event = this.isPostgres
          ? await eventRepo.findOne({
              where: { id: eventId },
              lock: { mode: 'pessimistic_write' },
            })
          : await eventRepo.findOne({ where: { id: eventId } });
        if (!event) throw new NotFoundException('Event not found');

        const existing = await partRepo.findOne({ where: { eventId, userId } });
        if (!existing) throw new NotFoundException('Not a participant');
        await partRepo.remove(existing);

        const count = await partRepo.count({ where: { eventId } });
        event.participantsCount = count;
        event.status = resolveEventStatus(count, event.capacity);
        await eventRepo.save(event);
        const fresh = await eventRepo.findOne({
          where: { id: eventId },
          relations: { host: true },
        });
        return { ...this.toPublic(fresh ?? event), isJoined: false };
      }),
    );
    // Promosi di luar transaksi leave (tidak menahan lock event).
    await this.promoteWaitlistHead(eventId);
    return result;
  }

  /** GET /events/:id/participants (SM-05) — daftar peserta urut joinedAt ASC. */
  async participants(
    eventId: string,
  ): Promise<{ data: EventParticipantItem[]; meta: { total: number } }> {
    const event = await this.events.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    const rows = await this.participantRows.find({
      where: { eventId },
      relations: { user: true },
      order: { joinedAt: 'ASC' },
    });
    return {
      data: rows.map((p) => ({
        userId: p.userId,
        email: p.user?.email ?? '',
        displayName: p.user?.displayName ?? null,
        avatarUrl: p.user?.avatarUrl ?? null,
        joinedAt: p.joinedAt,
      })),
      meta: { total: rows.length },
    };
  }

  /**
   * GET /events/:id/waitlist (ST-03) — hanya host (atau super_admin),
   * selain itu 403. Urut `position` ASC (terdepan dulu).
   */
  async listWaitlist(
    eventId: string,
    actor: ActorInput,
  ): Promise<{ data: WaitlistItem[]; meta: { total: number } }> {
    const event = await this.events.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    assertOwnerOrAdmin(actor, event.hostId);
    const rows = await this.waitlistRows.find({
      where: { eventId },
      relations: { user: true },
      order: { position: 'ASC' },
    });
    return { data: rows.map(toWaitlistItem), meta: { total: rows.length } };
  }

  /**
   * GET /events/:id/waitlist/me (ST-03) — posisi antreanku.
   * Tidak masuk antrean → 404.
   */
  async myWaitlistPosition(
    eventId: string,
    userId: string,
  ): Promise<WaitlistItem> {
    const event = await this.events.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    const row = await this.waitlistRows.findOne({
      where: { eventId, userId },
      relations: { user: true },
    });
    if (!row) throw new NotFoundException('Not in waitlist');
    return toWaitlistItem(row);
  }

  /**
   * DELETE /events/:id/waitlist/me (ST-03) — keluar dari antrean.
   * Tidak masuk antrean → 404. Posisi peserta lain TIDAK di-reorder
   * (mencerminkan urutan kedatangan; promosi selalu ambil yang terdepan).
   */
  async leaveWaitlist(
    eventId: string,
    userId: string,
  ): Promise<{ ok: true; eventId: string }> {
    const event = await this.events.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    const row = await this.waitlistRows.findOne({
      where: { eventId, userId },
    });
    if (!row) throw new NotFoundException('Not in waitlist');
    await this.waitlistRows.remove(row);
    return { ok: true, eventId };
  }

  /**
   * Promosi otomatis ST-03: bila ada slot kosong, antrean terdepan
   * (`waiting`, `position` terkecil) ditandai `invited` + notifikasi
   * best-effort. Dipanggil setelah `leave` dan setelah webhook settlement
   * yang (secara balapan) mendapati event sudah penuh.
   */
  async promoteWaitlistHead(eventId: string): Promise<void> {
    const event = await this.events.findOne({ where: { id: eventId } });
    if (!event) return;
    const count = await this.participantRows.count({ where: { eventId } });
    if (count >= event.capacity) return;
    const head = await this.waitlistRows.find({
      where: { eventId, status: 'waiting' },
      order: { position: 'ASC' },
      take: 1,
    });
    const first = head[0];
    if (!first) return;
    first.status = 'invited';
    await this.waitlistRows.save(first);
    // Notifikasi undangan — best-effort: tanpa device token / FCM down
    // promosi tetap tercatat (user bisa lihat via GET waitlist/me).
    try {
      await this.notifications.sendToUsers({
        userIds: [first.userId],
        title: 'Slot event tersedia',
        body: `Ada slot kosong di "${event.title}" — segera join sebelum penuh lagi.`,
        data: { type: 'event', entityId: eventId },
      });
    } catch {
      // Best-effort — abaikan agar leave/webhook tidak gagal.
    }
  }

  /**
   * Tandai payment pending yang berumur > TTL sebagai `expired`.
   * Oportunistik (dipanggil dari `join`); webhook expire/cancel juga
   * menutup payment. Mengembalikan jumlah yang di-expire.
   */
  private async expireDueEventPayments(
    payRepo: Repository<EventPayment>,
    eventId: string,
  ): Promise<number> {
    const cutoff = Date.now() - EVENT_PAYMENT_TTL_MS;
    const pendings = await payRepo.find({
      where: { eventId, status: 'pending' },
    });
    const due = pendings.filter(
      (p) => new Date(p.createdAt).getTime() <= cutoff,
    );
    for (const p of due) {
      p.status = 'expired';
      await payRepo.save(p);
    }
    return due.length;
  }

  toPublic(e: SportEvent, distanceMeters?: number): EventListItem {
    return {
      id: e.id,
      sport: e.sport,
      title: e.title,
      description: e.description ?? null,
      datetime: e.datetime,
      lat: e.lat,
      lng: e.lng,
      capacity: e.capacity,
      fee: e.fee ?? 0,
      participantsCount: e.participantsCount,
      status: e.status,
      photos: e.photos ?? [],
      host: {
        id: e.host?.id ?? e.hostId,
        email: e.host?.email ?? '',
        displayName: e.host?.displayName ?? null,
        avatarUrl: e.host?.avatarUrl ?? null,
      },
      ...(distanceMeters !== undefined ? { distanceMeters } : {}),
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    };
  }

  /**
   * Turunkan kolom `location` dari lat/lng agar queryable spasial.
   * Postgres: geography(Point,4326) via PostGIS. sqljs-test: WKT string.
   */
  private async syncLocation(eventId: string, lat: number, lng: number): Promise<void> {
    if (this.isPostgres) {
      await this.events.query(
        'UPDATE events SET location = ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography WHERE id = $3',
        [lat, lng, eventId],
      );
    } else {
      await this.events.query('UPDATE events SET location = ? WHERE id = ?', [
        `POINT(${lng} ${lat})`,
        eventId,
      ]);
    }
  }
}

/** Normalisasi + validasi URL foto event (maks 5, /uploads/ atau https). */
export function validateEventPhotos(input: string[]): string[] {
  assertPhotoUrls(input, MAX_EVENT_PHOTOS, 'Event photos');
  return input;
}

/** 409 event penuh + otomatis waitlisted (ST-03): body `{ waitlisted: true, position }`. */
export function waitlistedError(position: number): HttpException {
  return new HttpException(
    { message: 'Event is full', waitlisted: true, position },
    409,
  );
}

/**
 * Sinyal internal: join mendapati event penuh di dalam transaksi.
 * Posisi antrean dihitung di dalam lock/transaksi, baris waitlist ditulis
 * SETELAH commit oleh `join` (throw di dalam transaksi = rollback).
 */
class EventFullSignal {
  constructor(public readonly position: number) {}
}

/** True bila error DB adalah pelanggaran unique (Postgres 23505 / SQLite). */
function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const rec = err as Record<string, unknown>;
  if (rec.code === '23505') return true;
  const msg = [
    rec.message,
    (rec.driverError as Record<string, unknown> | undefined)?.message,
  ]
    .filter((m) => typeof m === 'string')
    .join(' ');
  return /unique|UNIQUE|uq_/i.test(msg);
}

/** `payment_ref` event = Midtrans `order_id` (unik, prefix `EV-` untuk routing webhook). */
export function generateEventPaymentRef(): string {
  return `EV-${Date.now()}-${randomBytes(4).toString('hex')}`;
}

export function toEventPaymentItem(p: EventPayment): EventPaymentItem {
  return {
    id: p.id,
    eventId: p.eventId,
    userId: p.userId,
    amount: p.amount,
    status: p.status,
    paymentRef: p.paymentRef,
    snapToken: p.snapToken ?? null,
    redirectUrl: p.redirectUrl ?? null,
    paidAt: p.paidAt ?? null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function toWaitlistItem(w: EventWaitlist): WaitlistItem {
  return {
    userId: w.userId,
    email: w.user?.email ?? '',
    displayName: w.user?.displayName ?? null,
    avatarUrl: w.user?.avatarUrl ?? null,
    position: w.position,
    status: w.status,
    createdAt: w.createdAt,
  };
}

/** Jarak great-circle (meter) untuk filter geo fallback sqljs. */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
