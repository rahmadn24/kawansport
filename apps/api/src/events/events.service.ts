import {
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { CreateEventDto } from './dto/create-event.dto';
import { ListEventsDto } from './dto/list-events.dto';
import { EventParticipant } from './event-participant.entity';
import { SportEvent, resolveEventStatus } from './event.entity';

const DEFAULT_RADIUS_M = 10000;

export interface EventListItem {
  id: string;
  sport: string;
  title: string;
  description: string | null;
  datetime: Date;
  lat: number;
  lng: number;
  capacity: number;
  participantsCount: number;
  status: 'open' | 'full';
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

@Injectable()
export class EventsService implements OnModuleInit {
  constructor(
    @InjectRepository(SportEvent)
    private readonly events: Repository<SportEvent>,
    @InjectRepository(EventParticipant)
    private readonly participantRows: Repository<EventParticipant>,
    private readonly users: UsersService,
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
      participantsCount: 1,
      status: resolveEventStatus(1, dto.capacity),
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
   * POST /events/:id/join (SM-05) — transaksional anti-race:
   * kunci baris event (SELECT FOR UPDATE di Postgres), tolak double-join 409
   * dan event penuh 409, lalu insert peserta + update count/status atomik.
   */
  async join(
    eventId: string,
    userId: string,
  ): Promise<EventListItem & { isJoined: boolean }> {
    return this.withEventLock(eventId, () =>
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
        if (existing) throw new ConflictException('Already joined');

        const count = await partRepo.count({ where: { eventId } });
        if (count >= event.capacity) throw new ConflictException('Event is full');

        try {
          await partRepo.save(partRepo.create({ eventId, userId }));
        } catch {
          // Balapan antar-proses lolos dari cek di atas: unique pair melarang
          // duplikat; baca ulang untuk pesan error yang tepat.
          const raced = await partRepo.findOne({ where: { eventId, userId } });
          if (raced) throw new ConflictException('Already joined');
          const recount = await partRepo.count({ where: { eventId } });
          if (recount >= event.capacity) throw new ConflictException('Event is full');
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
      }),
    );
  }

  /**
   * POST /events/:id/leave (SM-05) — transaksional: hapus peserta,
   * hitung ulang count + status open/full atomik. Bukan peserta -> 404.
   */
  async leave(
    eventId: string,
    userId: string,
  ): Promise<EventListItem & { isJoined: boolean }> {
    return this.withEventLock(eventId, () =>
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
      participantsCount: e.participantsCount,
      status: e.status,
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
