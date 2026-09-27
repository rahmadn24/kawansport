import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Booking } from '../bookings/booking.entity';
import { Conversation } from '../chat/conversation.entity';
import {
  DEFAULT_ELO_SCORE,
  PROVISIONAL_MATCH_LIMIT,
} from '../elo/elo.service';
import { EloRating } from '../elo/elo-rating.entity';
import { EventParticipant } from '../events/event-participant.entity';
import { SportEvent } from '../events/event.entity';
import { Court } from '../venues/court.entity';
import { SearchUsersDto } from './dto/search-users.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { SkillLevel, User, UserRole } from './user.entity';

export const DEFAULT_SEARCH_RADIUS_M = 10000;

/** Maksimal anggota circle (ST-07) — definisi lihat getCircle. */
export const MAX_CIRCLE_MEMBERS = 50;

/** Default rentang ELO EL-01: skorku ±100 bila eloSport tanpa batas eksplisit. */
export const DEFAULT_ELO_DELTA = 100;

/** Badge skor ELO per hasil pencarian (EL-01, hanya bila eloSport diminta). */
export interface EloSearchBadge {
  sport: string;
  score: number;
  /** true bila belum punya rating (skor default) atau matchesPlayed < 10. */
  provisional: boolean;
}

export interface UserSearchItem {
  id: string;
  email: string;
  displayName: string | null;
  sports: string[];
  skillLevel: SkillLevel | null;
  lat: number | null;
  lng: number | null;
  avatarUrl: string | null;
  /** ST-07: badge terverifikasi (default false). */
  verified: boolean;
  /** Meter dari titik query; hanya ada saat filter lat/lng dipakai. */
  distanceMeters?: number;
  /** EL-01: badge ELO; hanya ada saat query eloSport diisi. */
  elo?: EloSearchBadge;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Statistik profil (ST-07 TERBATAS) — seluruh angka dari data REAL:
 * event yang di-host, partisipasi event, booking lunas, dan gabungan
 * cabor (profil + event yang di-host + court dari booking lunas).
 * SENGAJA TANPA win-rate: butuh riwayat hasil match (DEPEND EL-00).
 * TODO-EL-00: tambah winRate saat entitas match history ada.
 */
export interface UserStats {
  user: {
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
    verified: boolean;
  };
  totalEventsHosted: number;
  /** Termasuk event sendiri yang di-host (host = peserta #1). */
  totalEventsJoined: number;
  totalBookingsPaid: number;
  sportsCount: number;
  sports: string[];
}

/**
 * Satu anggota lingkaran mabar (ST-07) — ringkasan publik + badge verified.
 * TODO-EL-04: achievement tidak dimuat di sini (entitas belum ada).
 */
export interface CircleMember {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  verified: boolean;
  sports: string[];
  skillLevel: SkillLevel | null;
}

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(SportEvent)
    private readonly events: Repository<SportEvent>,
    @InjectRepository(EventParticipant)
    private readonly participants: Repository<EventParticipant>,
    @InjectRepository(Booking)
    private readonly bookings: Repository<Booking>,
    @InjectRepository(Court)
    private readonly courts: Repository<Court>,
    @InjectRepository(Conversation)
    private readonly conversations: Repository<Conversation>,
    @InjectRepository(EloRating)
    private readonly eloRatings: Repository<EloRating>,
  ) {}

  /** Buat extension PostGIS + GIST index (postgres saja, idempotent). */
  async onModuleInit() {
    if (this.users.manager.connection.options.type !== 'postgres') return;
    try {
      await this.users.query('CREATE EXTENSION IF NOT EXISTS postgis');
    } catch {
      // Kurang hak / sudah ada — index di bawah tetap dicoba.
    }
    try {
      await this.users.query(
        'CREATE INDEX IF NOT EXISTS idx_users_location_gist ON users USING GIST (location)',
      );
    } catch {
      // Index spasial gagal dibuat (mis. kolom belum sinkron) — tidak fatal.
    }
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email: email.toLowerCase().trim() } });
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  async create(input: {
    email: string;
    passwordHash: string;
    displayName?: string;
    role?: UserRole;
  }): Promise<User> {
    const user = this.users.create({
      email: input.email.toLowerCase().trim(),
      passwordHash: input.passwordHash,
      displayName: input.displayName,
      sports: [],
      // Default user baru = `user` (AD-01). Role lain hanya via seed/admin.
      role: input.role ?? 'user',
    });
    return this.users.save(user);
  }

  /** PATCH /me — validasi pasangan lat/lng + normalisasi sports, sinkronkan kolom geo. */
  async updateProfile(id: string, dto: UpdateMeDto): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new BadRequestException('User not found');

    if (dto.displayName !== undefined) {
      const name = dto.displayName?.trim() || null;
      user.displayName = name ?? undefined;
    }
    if (dto.sports !== undefined) {
      user.sports = normalizeSports(dto.sports);
    }
    if (dto.skillLevel !== undefined) {
      user.skillLevel = dto.skillLevel as SkillLevel;
    }

    const latSet = dto.lat !== undefined;
    const lngSet = dto.lng !== undefined;
    if (latSet !== lngSet) {
      throw new BadRequestException('lat and lng must be provided together');
    }
    if (latSet && lngSet) {
      const lat = dto.lat ?? null;
      const lng = dto.lng ?? null;
      if ((lat === null) !== (lng === null)) {
        throw new BadRequestException('lat and lng must be provided together');
      }
      user.lat = lat;
      user.lng = lng;
    }

    const saved = await this.users.save(user);
    await this.syncLocation(saved.id, saved.lat ?? null, saved.lng ?? null);
    const fresh = await this.findById(saved.id);
    return fresh ?? saved;
  }

  async setAvatar(id: string, avatarUrl: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new BadRequestException('User not found');
    user.avatarUrl = avatarUrl;
    return this.users.save(user);
  }

  /**
   * Turunkan kolom `location` dari lat/lng agar queryable spasial.
   * Postgres: geography(Point,4326) via PostGIS. sqljs-test: WKT string.
   */
  private async syncLocation(
    userId: string,
    lat: number | null,
    lng: number | null,
  ): Promise<void> {
    const isPostgres =
      this.users.manager.connection.options.type === 'postgres';
    if (lat == null || lng == null) {
      await this.users.query(
        isPostgres
          ? 'UPDATE users SET location = NULL WHERE id = $1'
          : 'UPDATE users SET location = NULL WHERE id = ?',
        [userId],
      );
      return;
    }
    if (isPostgres) {
      await this.users.query(
        'UPDATE users SET location = ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography WHERE id = $3',
        [lat, lng, userId],
      );
    } else {
      await this.users.query('UPDATE users SET location = ? WHERE id = ?', [
        `POINT(${lng} ${lat})`,
        userId,
      ]);
    }
  }

  toPublic(user: User) {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName ?? null,
      role: (user.role ?? 'user') as UserRole,
      sports: user.sports ?? [],
      skillLevel: user.skillLevel ?? null,
      lat: user.lat ?? null,
      lng: user.lng ?? null,
      avatarUrl: user.avatarUrl ?? null,
      loyaltyPoints: user.loyaltyPoints ?? 0,
      verified: user.verified ?? false,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt ?? null,
    };
  }

  /**
   * POST /users/:id/verify (ST-07, khusus super_admin) — tandai terverifikasi.
   * Idempotent: verifikasi ulang tetap 200 tanpa efek samping.
   */
  async verify(id: string) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    if (!user.verified) {
      user.verified = true;
      await this.users.save(user);
    }
    const fresh = await this.findById(id);
    return this.toPublic(fresh ?? user);
  }

  /**
   * GET /users/:id/stats (ST-07) — statistik dari data REAL yang ada.
   * sports = gabungan cabor profil + event yang diikuti (termasuk yang
   * di-host — host = peserta #1) + court dari booking lunas (normalisasi
   * trim/dedupe case-insensitive). TANPA win-rate (butuh EL-00) — JANGAN
   * baca kolom palsu; lihat TODO-EL-00 di interface.
   */
  async getStats(id: string): Promise<UserStats> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    const [hosted, joined, paidBookings] = await Promise.all([
      this.events.find({ where: { hostId: id } }),
      this.participants.find({ where: { userId: id } }),
      this.bookings.find({ where: { userId: id, status: 'paid' } }),
    ]);
    let eventSports: string[] = [];
    const joinedEventIds = [...new Set(joined.map((p) => p.eventId))];
    if (joinedEventIds.length > 0) {
      const joinedEvents = await this.events.find({
        where: { id: In(joinedEventIds) },
      });
      eventSports = joinedEvents.map((e) => e.sport);
    }
    let courtSports: string[] = [];
    if (paidBookings.length > 0) {
      const courtIds = [...new Set(paidBookings.map((b) => b.courtId))];
      const courts = await this.courts.find({ where: { id: In(courtIds) } });
      courtSports = courts.map((c) => c.sport);
    }
    const sports = normalizeSports([
      ...(user.sports ?? []),
      ...eventSports,
      ...courtSports,
    ]);
    return {
      user: {
        id: user.id,
        displayName: user.displayName ?? null,
        avatarUrl: user.avatarUrl ?? null,
        verified: user.verified ?? false,
      },
      totalEventsHosted: hosted.length,
      totalEventsJoined: joined.length,
      totalBookingsPaid: paidBookings.length,
      sportsCount: sports.length,
      sports,
    };
  }

  /**
   * GET /users/me/circle (ST-07) — "teman rutin" = DEFINISI SEDERHANA V1:
   * gabungan (a) partner chat 1-1 (punya conversation bersama) dan
   * (b) co-participants event (pernah 1 event bersama sebagai peserta
   * maupun host — termasuk host event yang saya ikuti dan peserta event
   * yang saya host). Dedupe + exclude diri sendiri, maks 50 (urut:
   * partner chat dulu, lalu co-participants). Tombol "Ajak Mabar" memakai
   * ulang POST /invites (GAP-01, sudah ada — TANPA endpoint baru).
   * TODO-EL-00: riwayat match tidak dipakai (entitas belum ada).
   */
  async getCircle(
    myId: string,
  ): Promise<{ data: CircleMember[]; meta: { total: number } }> {
    const me = await this.findById(myId);
    if (!me) throw new NotFoundException('User not found');

    const convs = await this.conversations.find({
      where: [{ userA: myId }, { userB: myId }],
    });
    const chatIds = convs.map((c) => (c.userA === myId ? c.userB : c.userA));

    const mine = await this.participants.find({ where: { userId: myId } });
    const hosted = await this.events.find({ where: { hostId: myId } });
    const eventIds = [
      ...new Set([...mine.map((p) => p.eventId), ...hosted.map((e) => e.id)]),
    ];
    let coIds: string[] = [];
    let hostIds: string[] = [];
    if (eventIds.length > 0) {
      const co = await this.participants.find({
        where: { eventId: In(eventIds) },
      });
      coIds = co.map((p) => p.userId);
      const evts = await this.events.find({ where: { id: In(eventIds) } });
      hostIds = evts.map((e) => e.hostId);
    }

    const ids = [...new Set([...chatIds, ...coIds, ...hostIds])]
      .filter((uid) => uid !== myId)
      .slice(0, MAX_CIRCLE_MEMBERS);
    if (ids.length === 0) return { data: [], meta: { total: 0 } };

    const members = await this.users.find({ where: { id: In(ids) } });
    const order = new Map(ids.map((uid, i) => [uid, i]));
    members.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    return {
      data: members.map((m) => ({
        id: m.id,
        email: m.email,
        displayName: m.displayName ?? null,
        avatarUrl: m.avatarUrl ?? null,
        verified: m.verified ?? false,
        sports: m.sports ?? [],
        skillLevel: m.skillLevel ?? null,
      })),
      meta: { total: members.length },
    };
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.users.update(userId, { lastLoginAt: new Date() });
  }

  /**
   * GET /admin/users — daftar semua user untuk CMS (khusus super_admin).
   * Filter role + search (email/displayName, substring case-insensitive),
   * sort createdAt DESC + pagination + meta. Filter di memori agar
   * portabel postgres/sqljs.
   */
  async listForAdmin(query: {
    role?: UserRole;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: ReturnType<UsersService['toPublic']>[];
    meta: { page: number; limit: number; total: number };
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim().toLowerCase() || null;
    const rows = await this.users.find({ order: { createdAt: 'DESC' } });
    const filtered = rows.filter((u) => {
      if (query.role && u.role !== query.role) return false;
      if (search) {
        const hay = `${u.email}\n${u.displayName ?? ''}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });
    const total = filtered.length;
    const slice = filtered.slice((page - 1) * limit, page * limit);
    return {
      data: slice.map((u) => this.toPublic(u)),
      meta: { page, limit, total },
    };
  }

  /**
   * GET /users/search (SM-06 + EL-01) — cari partner sparing.
   * - Selalu exclude diri sendiri (selfId).
   * - Filter sport: overlap case-insensitive terhadap satu item sports[].
   * - Filter skill: cocok persis.
   * - Filter geo (bila lat+lng diisi): ST_DWithin radius meter memakai GIST
   *   index `idx_users_location_gist` (dibuat idempotent di onModuleInit),
   *   sort jarak ASC. User tanpa lokasi (lat/lng null) tidak ikut hasil geo.
   * - Filter ELO EL-01 (bila eloSport diisi): skor efektif tiap kandidat
   *   (rating cabor tsb, atau DEFAULT_ELO_SCORE=1000 provisional bila belum
   *   punya) harus dalam [lo, hi] inklusif. lo/hi: eksplisit eloMin/eloMax
   *   (sisi yang tak diisi = tak dibatasi); bila keduanya tak diisi =
   *   [skorku-delta, skorku+delta] dengan delta = eloMaxDelta ?? 100
   *   (skorku = ratingku cabor tsb, atau 1000 bila aku pun belum punya).
   *   eloMin/eloMax/eloMaxDelta tanpa eloSport -> 400; eloMin > eloMax -> 400.
   *   Tiap item hasil memuat `elo: { sport, score, provisional }`.
   * - Tanpa geo: sort createdAt ASC (deterministik).
   * - Pagination page/limit + meta { page, limit, total } (total SUDAH
   *   memperhitungkan filter ELO — filter diterapkan SEBELUM paginasi).
   */
  async searchUsers(
    selfId: string,
    query: SearchUsersDto,
  ): Promise<{
    data: UserSearchItem[];
    meta: { page: number; limit: number; total: number };
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const latSet = query.lat !== undefined;
    const lngSet = query.lng !== undefined;
    if (latSet !== lngSet) {
      throw new BadRequestException('lat and lng must be provided together');
    }
    const useGeo = latSet && lngSet;
    const radius = query.radius ?? DEFAULT_SEARCH_RADIUS_M;
    const elo = await this.resolveEloFilter(selfId, query);

    if (this.users.manager.connection.options.type === 'postgres') {
      return this.searchPostgres(query, selfId, page, limit, useGeo, radius, elo);
    }
    return this.searchSqljs(query, selfId, page, limit, useGeo, radius, elo);
  }

  /**
   * Validasi + resolusi filter ELO EL-01. null bila eloSport tak diisi.
   * Cabor dicocokkan case-insensitive (konsisten dengan filter sport SM-06).
   */
  private async resolveEloFilter(
    selfId: string,
    query: SearchUsersDto,
  ): Promise<{ sport: string; lo: number; hi: number } | null> {
    const sport = query.eloSport?.trim();
    const hasBounds =
      query.eloMin !== undefined ||
      query.eloMax !== undefined ||
      query.eloMaxDelta !== undefined;
    if (!sport) {
      if (hasBounds) {
        throw new BadRequestException(
          'eloSport is required when eloMin/eloMax/eloMaxDelta is set',
        );
      }
      return null;
    }
    if (
      query.eloMin !== undefined &&
      query.eloMax !== undefined &&
      query.eloMin > query.eloMax
    ) {
      throw new BadRequestException('eloMin must not exceed eloMax');
    }
    const lower = sport.toLowerCase();
    const mine = await this.eloRatings.find({ where: { userId: selfId } });
    const myScore =
      mine.find((r) => r.sport.toLowerCase() === lower)?.score ??
      DEFAULT_ELO_SCORE;
    if (query.eloMin === undefined && query.eloMax === undefined) {
      const delta = query.eloMaxDelta ?? DEFAULT_ELO_DELTA;
      return { sport, lo: myScore - delta, hi: myScore + delta };
    }
    return {
      sport,
      lo: query.eloMin ?? Number.MIN_SAFE_INTEGER,
      hi: query.eloMax ?? Number.MAX_SAFE_INTEGER,
    };
  }

  /** Peta userId -> rating cabor (case-insensitive) untuk badge + filter sqljs. */
  private async loadEloMap(
    sport: string,
  ): Promise<Map<string, { score: number; matchesPlayed: number }>> {
    const lower = sport.toLowerCase();
    const rows = await this.eloRatings.find();
    const map = new Map<string, { score: number; matchesPlayed: number }>();
    for (const r of rows) {
      if (r.sport.toLowerCase() === lower && !map.has(r.userId)) {
        map.set(r.userId, { score: r.score, matchesPlayed: r.matchesPlayed });
      }
    }
    return map;
  }

  private toEloBadge(
    sport: string,
    row: { score: number; matchesPlayed: number } | undefined,
  ): EloSearchBadge {
    return {
      sport,
      score: row?.score ?? DEFAULT_ELO_SCORE,
      provisional: row ? row.matchesPlayed < PROVISIONAL_MATCH_LIMIT : true,
    };
  }

  private async searchPostgres(
    query: SearchUsersDto,
    selfId: string,
    page: number,
    limit: number,
    useGeo: boolean,
    radius: number,
    elo: { sport: string; lo: number; hi: number } | null,
  ): Promise<{ data: UserSearchItem[]; meta: { page: number; limit: number; total: number } }> {
    const qb = this.users
      .createQueryBuilder('u')
      .where('u.id != :selfId', { selfId })
      .skip((page - 1) * limit)
      .take(limit);

    if (query.sport?.trim()) {
      // Cocok satu elemen array case-insensitive; unnest memakai index
      // parsial bila ada, filter spasial di bawah memakai GIST index.
      qb.andWhere(
        'EXISTS (SELECT 1 FROM unnest(u.sports) AS s WHERE LOWER(s) = LOWER(:sport))',
        { sport: query.sport.trim() },
      );
    }
    if (query.skill) {
      qb.andWhere('u.skillLevel = :skill', { skill: query.skill });
    }
    if (elo) {
      // LEFT JOIN satu baris rating cabor (UNIQUE user+sport) + COALESCE ke
      // skor default agar yang belum punya rating ikut terfilter sebagai 1000.
      qb.leftJoin(
        EloRating,
        'er',
        'er.userId = u.id AND LOWER(er.sport) = LOWER(:eloSport)',
        { eloSport: elo.sport },
      ).andWhere('COALESCE(er.score, :eloDefault) BETWEEN :eloLo AND :eloHi', {
        eloDefault: DEFAULT_ELO_SCORE,
        eloLo: elo.lo,
        eloHi: elo.hi,
      });
    }
    if (useGeo) {
      // ST_DWithin geography memakai idx_users_location_gist; user tanpa
      // location (NULL) otomatis gugur karena DWithin NULL -> NULL.
      qb.andWhere(
        'ST_DWithin(u.location, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :radius)',
        { lat: query.lat, lng: query.lng, radius },
      );
      qb.addSelect(
        'ST_Distance(u.location, ST_SetSRID(ST_MakePoint(:lngQ, :latQ), 4326)::geography)',
        'distanceMeters',
      ).setParameters({ latQ: query.lat, lngQ: query.lng });
      qb.orderBy('distanceMeters', 'ASC');
    } else {
      qb.orderBy('u.createdAt', 'ASC');
    }

    const [rows, total] = await qb.getManyAndCount();
    let distances: Array<number | null> = [];
    if (useGeo) {
      const raw = await qb.getRawMany<{ distanceMeters: string }>();
      distances = raw.map((r) => (r.distanceMeters == null ? null : Number(r.distanceMeters)));
    }
    // Badge ELO untuk halaman ini (batch satu query, cocok case-insensitive).
    let eloMap: Map<string, { score: number; matchesPlayed: number }> | null = null;
    if (elo) {
      eloMap = await this.loadEloMap(elo.sport);
    }
    return {
      data: rows.map((u, i) =>
        this.toSearchItem(
          u,
          useGeo && distances[i] != null ? Math.round(distances[i] as number) : undefined,
          elo && eloMap ? this.toEloBadge(elo.sport, eloMap.get(u.id)) : undefined,
        ),
      ),
      meta: { page, limit, total },
    };
  }

  /** Fallback sqljs (e2e tanpa Postgres): filter + sort jarak di memori. */
  private async searchSqljs(
    query: SearchUsersDto,
    selfId: string,
    page: number,
    limit: number,
    useGeo: boolean,
    radius: number,
    elo: { sport: string; lo: number; hi: number } | null,
  ): Promise<{ data: UserSearchItem[]; meta: { page: number; limit: number; total: number } }> {
    const rows = await this.users.find({ order: { createdAt: 'ASC' } });
    const sport = query.sport?.trim().toLowerCase();
    const eloMap = elo ? await this.loadEloMap(elo.sport) : null;

    const withDistance = rows
      .filter((u) => u.id !== selfId)
      .filter((u) => {
        if (sport) {
          const sports = (u.sports ?? []).map((s) => String(s).toLowerCase());
          if (!sports.includes(sport)) return false;
        }
        if (query.skill && u.skillLevel !== query.skill) return false;
        if (elo && eloMap) {
          const score = eloMap.get(u.id)?.score ?? DEFAULT_ELO_SCORE;
          if (score < elo.lo || score > elo.hi) return false;
        }
        if (useGeo) {
          if (u.lat == null || u.lng == null) return false;
          const d = haversineMeters(query.lat as number, query.lng as number, u.lat, u.lng);
          if (d > radius) return false;
        }
        return true;
      })
      .map((u) => ({
        user: u,
        distance:
          useGeo && u.lat != null && u.lng != null
            ? haversineMeters(query.lat as number, query.lng as number, u.lat, u.lng)
            : null,
      }));

    if (useGeo) {
      withDistance.sort((a, b) => (a.distance as number) - (b.distance as number));
    }

    const total = withDistance.length;
    const slice = withDistance.slice((page - 1) * limit, page * limit);
    return {
      data: slice.map(({ user, distance }) =>
        this.toSearchItem(
          user,
          distance != null ? Math.round(distance) : undefined,
          elo && eloMap ? this.toEloBadge(elo.sport, eloMap.get(user.id)) : undefined,
        ),
      ),
      meta: { page, limit, total },
    };
  }

  private toSearchItem(
    user: User,
    distanceMeters?: number,
    elo?: EloSearchBadge,
  ): UserSearchItem {
    return {
      ...this.toPublic(user),
      ...(distanceMeters !== undefined ? { distanceMeters } : {}),
      ...(elo !== undefined ? { elo } : {}),
    };
  }
}

/** Trim, buang kosong, dedupe (case-insensitive), batasi wajar. */
export function normalizeSports(input: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    const s = String(raw ?? '').trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/** Jarak great-circle (meter) untuk filter/sort geo fallback sqljs. */
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
