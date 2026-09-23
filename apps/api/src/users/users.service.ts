import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SearchUsersDto } from './dto/search-users.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { SkillLevel, User, UserRole } from './user.entity';

export const DEFAULT_SEARCH_RADIUS_M = 10000;

export interface UserSearchItem {
  id: string;
  email: string;
  displayName: string | null;
  sports: string[];
  skillLevel: SkillLevel | null;
  lat: number | null;
  lng: number | null;
  avatarUrl: string | null;
  /** Meter dari titik query; hanya ada saat filter lat/lng dipakai. */
  distanceMeters?: number;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
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
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt ?? null,
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
   * GET /users/search (SM-06) — cari partner sparing.
   * - Selalu exclude diri sendiri (selfId).
   * - Filter sport: overlap case-insensitive terhadap satu item sports[].
   * - Filter skill: cocok persis.
   * - Filter geo (bila lat+lng diisi): ST_DWithin radius meter memakai GIST
   *   index `idx_users_location_gist` (dibuat idempotent di onModuleInit),
   *   sort jarak ASC. User tanpa lokasi (lat/lng null) tidak ikut hasil geo.
   * - Tanpa geo: sort createdAt ASC (deterministik).
   * - Pagination page/limit + meta { page, limit, total }.
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

    if (this.users.manager.connection.options.type === 'postgres') {
      return this.searchPostgres(query, selfId, page, limit, useGeo, radius);
    }
    return this.searchSqljs(query, selfId, page, limit, useGeo, radius);
  }

  private async searchPostgres(
    query: SearchUsersDto,
    selfId: string,
    page: number,
    limit: number,
    useGeo: boolean,
    radius: number,
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
    return {
      data: rows.map((u, i) =>
        this.toSearchItem(
          u,
          useGeo && distances[i] != null ? Math.round(distances[i] as number) : undefined,
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
  ): Promise<{ data: UserSearchItem[]; meta: { page: number; limit: number; total: number } }> {
    const rows = await this.users.find({ order: { createdAt: 'ASC' } });
    const sport = query.sport?.trim().toLowerCase();

    const withDistance = rows
      .filter((u) => u.id !== selfId)
      .filter((u) => {
        if (sport) {
          const sports = (u.sports ?? []).map((s) => String(s).toLowerCase());
          if (!sports.includes(sport)) return false;
        }
        if (query.skill && u.skillLevel !== query.skill) return false;
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
        this.toSearchItem(user, distance != null ? Math.round(distance) : undefined),
      ),
      meta: { page, limit, total },
    };
  }

  private toSearchItem(user: User, distanceMeters?: number): UserSearchItem {
    return {
      ...this.toPublic(user),
      ...(distanceMeters !== undefined ? { distanceMeters } : {}),
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
