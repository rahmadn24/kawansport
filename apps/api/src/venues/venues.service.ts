import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { assertOwnerOrAdmin, isOwnerOrAdmin } from '../auth/ownership';
import type { ActorInput } from '../auth/ownership';
import {
  COURT_SENSITIVE_FIELDS,
  VENUE_SENSITIVE_FIELDS,
  buildCourtPayload,
  buildVenuePayload,
  hasSensitiveKeys,
} from '../change-requests/entity-patches';
import {
  ChangeRequestsService,
  PendingChangeResponse,
  toPendingChange,
} from '../change-requests/change-requests.service';
import { normalizeSports } from '../users/users.service';
import { UsersService } from '../users/users.service';
import { assertPhotoUrls, isAllowedPhotoUrl } from '../uploads/photo-url';
import { Court, CourtStatus } from './court.entity';
import { CreateCourtDto } from './dto/create-court.dto';
import { CreateVenueDocumentDto } from './dto/create-venue-document.dto';
import { CreateVenueDto } from './dto/create-venue.dto';
import { ListVenuesDto } from './dto/list-venues.dto';
import { UpdateCourtDto } from './dto/update-court.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { Venue } from './venue.entity';
import {
  VenueDocument,
  VenueDocumentStatus,
} from './venue-document.entity';
import { VerifyVenueDocumentDto } from './dto/verify-venue-document.dto';

const DEFAULT_RADIUS_M = 10000;

export interface VenueItem {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  sports: string[];
  photos: string[];
  owner: { id: string; email: string; displayName: string | null };
  status: Venue['status'];
  rejectionReason: string | null;
  /** Id editor terakhir (AD-02, jejak audit; null bila belum pernah diubah). */
  updatedBy: string | null;
  courts: CourtItem[];
  /** Meter dari titik query; hanya ada saat filter lat/lng dipakai. */
  distanceMeters?: number;
  /**
   * Dokumen legalitas + status turunan (API-W01). HANYA ada bila detail
   * dibuka owner venue / super_admin; publik (termasuk list) tidak memuatnya.
   */
  documents?: VenueDocumentItem[];
  legalitas?: VenueLegalitas;
  createdAt: Date;
  updatedAt: Date;
}

export interface CourtItem {
  id: string;
  venueId: string;
  sport: string;
  name: string;
  pricePerHour: number;
  openHours: Record<string, unknown> | null;
  status: CourtStatus;
  /** Id editor terakhir (AD-02, jejak audit; null bila belum pernah diubah). */
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface VenueDocumentItem {
  id: string;
  venueId: string;
  type: VenueDocument['type'];
  url: string;
  status: VenueDocumentStatus;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Status legalitas turunan (API-W01, hanya di detail owner/admin):
 * `lengkap` bila >= 2 dokumen `verified`; `parsial` bila >= 1 dokumen
 * apa pun statusnya; selain itu `kosong`.
 */
export type VenueLegalitas = 'lengkap' | 'parsial' | 'kosong';

export function computeLegalitas(
  docs: ReadonlyArray<{ status: VenueDocumentStatus }>,
): VenueLegalitas {
  if (docs.filter((d) => d.status === 'verified').length >= 2) return 'lengkap';
  if (docs.length >= 1) return 'parsial';
  return 'kosong';
}

@Injectable()
export class VenuesService implements OnModuleInit {
  constructor(
    @InjectRepository(Venue)
    private readonly venues: Repository<Venue>,
    @InjectRepository(Court)
    private readonly courts: Repository<Court>,
    @InjectRepository(VenueDocument)
    private readonly documents: Repository<VenueDocument>,
    private readonly users: UsersService,
    private readonly changeRequests: ChangeRequestsService,
  ) {}

  /** Buat extension PostGIS + GIST index (postgres saja, idempotent). */
  async onModuleInit() {
    if (this.venues.manager.connection.options.type !== 'postgres') return;
    try {
      await this.venues.query('CREATE EXTENSION IF NOT EXISTS postgis');
    } catch {
      // Kurang hak / sudah ada — index di bawah tetap dicoba.
    }
    try {
      await this.venues.query(
        'CREATE INDEX IF NOT EXISTS idx_venues_location_gist ON venues USING GIST (location)',
      );
    } catch {
      // Index spasial gagal dibuat — tidak fatal.
    }
    try {
      await this.venues.query(
        'CREATE INDEX IF NOT EXISTS idx_venues_status ON venues (status)',
      );
    } catch {
      // Index status gagal dibuat — tidak fatal.
    }
  }

  private get isPostgres(): boolean {
    return this.venues.manager.connection.options.type === 'postgres';
  }

  /**
   * POST /venues — owner otomatis = current user.
   * venue_owner langsung `pending` (menunggu moderasi admin);
   * super_admin mulai dari `draft` (bisa submit manual).
   */
  async create(actor: ActorInput, dto: CreateVenueDto): Promise<VenueItem> {
    const owner = await this.users.findById(actor.id);
    if (!owner) throw new NotFoundException('Owner not found');

    const venue = this.venues.create({
      name: dto.name.trim(),
      address: dto.address.trim(),
      lat: dto.lat,
      lng: dto.lng,
      sports: normalizeSports(dto.sports ?? []),
      photos: validateVenuePhotos(normalizePhotos(dto.photos ?? [])),
      ownerId: actor.id,
      status: actor.role === 'super_admin' ? 'draft' : 'pending',
      rejectionReason: null,
    });
    const saved = await this.venues.save(venue);
    await this.syncLocation(saved.id, saved.lat, saved.lng);
    return this.mustDetail(saved.id, actor);
  }

  /**
   * PATCH /venues/:id — hanya owner venue atau super_admin.
   * AD-02: bila editor BUKAN admin dan venue sudah `approved` serta payload
   * menyentuh field sensitif (name) → TIDAK langsung diubah,
   * melainkan dicatat sebagai change request `pending` (202 + CR id, publik
   * tetap data lama). ST-01: foto dikecualikan — selalu langsung disimpan.
   * Admin / entity non-approved → langsung ubah.
   */
  async update(
    id: string,
    actor: ActorInput,
    dto: UpdateVenueDto,
  ): Promise<VenueItem | PendingChangeResponse> {
    const venue = await this.venues.findOne({ where: { id } });
    if (!venue) throw new NotFoundException('Venue not found');
    assertOwnerOrAdmin(actor, venue.ownerId);

    const latSet = dto.lat !== undefined;
    const lngSet = dto.lng !== undefined;
    if (latSet !== lngSet) {
      throw new BadRequestException('lat and lng must be provided together');
    }

    const isAdmin = actor.role === 'super_admin';
    if (
      !isAdmin &&
      venue.status === 'approved' &&
      hasSensitiveKeys(dto as Record<string, unknown>, VENUE_SENSITIVE_FIELDS)
    ) {
      const cr = await this.changeRequests.create({
        entityType: 'venue',
        entityId: venue.id,
        payload: buildVenuePayload(dto) as Record<string, unknown>,
        requestedBy: actor.id,
      });
      return toPendingChange(cr);
    }

    const patch = buildVenuePayload(dto);
    if (patch.name !== undefined) venue.name = patch.name;
    if (patch.address !== undefined) venue.address = patch.address;
    if (latSet && lngSet) {
      venue.lat = patch.lat as number;
      venue.lng = patch.lng as number;
    }
    if (patch.sports !== undefined) venue.sports = normalizeSports(patch.sports);
    if (patch.photos !== undefined) {
      venue.photos = validateVenuePhotos(normalizePhotos(patch.photos));
    }
    venue.updatedBy = actor.id;

    const saved = await this.venues.save(venue);
    if (latSet && lngSet) await this.syncLocation(saved.id, saved.lat, saved.lng);
    return this.mustDetail(saved.id, actor);
  }

  /** POST /venues/:id/submit — draft -> pending (owner / super_admin). */
  async submit(id: string, actor: ActorInput): Promise<VenueItem> {
    const venue = await this.venues.findOne({ where: { id } });
    if (!venue) throw new NotFoundException('Venue not found');
    assertOwnerOrAdmin(actor, venue.ownerId);
    if (venue.status !== 'draft') {
      throw new ConflictException('Only draft venues can be submitted');
    }
    venue.status = 'pending';
    await this.venues.save(venue);
    return this.mustDetail(id, actor);
  }

  /**
   * POST /venues/:id/photos — tambah satu foto (ST-01, owner / super_admin).
   * ST-01: foto TIDAK lewat change request — langsung disimpan apa pun
   * status venue (venue tetap harus `approved` agar tampil publik).
   * Duplikat diabaikan; >5 foto → 400.
   */
  async addPhoto(id: string, actor: ActorInput, url: string): Promise<VenueItem> {
    const venue = await this.venues.findOne({ where: { id } });
    if (!venue) throw new NotFoundException('Venue not found');
    assertOwnerOrAdmin(actor, venue.ownerId);
    const next = validateVenuePhotos(
      normalizePhotos([...(venue.photos ?? []), url.trim()]),
    );
    venue.photos = next;
    venue.updatedBy = actor.id;
    await this.venues.save(venue);
    return this.mustDetail(id, actor);
  }

  /**
   * DELETE /venues/:id/photos — hapus satu foto (ST-01, owner / super_admin).
   * Langsung disimpan (tanpa change request). Foto tidak ada → 404.
   */
  async removePhoto(
    id: string,
    actor: ActorInput,
    url: string,
  ): Promise<VenueItem> {
    const venue = await this.venues.findOne({ where: { id } });
    if (!venue) throw new NotFoundException('Venue not found');
    assertOwnerOrAdmin(actor, venue.ownerId);
    const target = url.trim();
    const current = venue.photos ?? [];
    if (!current.includes(target)) throw new NotFoundException('Photo not found');
    venue.photos = current.filter((p) => p !== target);
    venue.updatedBy = actor.id;
    await this.venues.save(venue);
    return this.mustDetail(id, actor);
  }

  /**
   * POST /venues/:id/documents — tambah dokumen legalitas (API-W01).
   * Hanya owner venue / super_admin (403 lintas owner). URL mengikuti
   * aturan ST-01 (`/uploads/` atau `https`); status awal selalu `pending`.
   */
  async addDocument(
    id: string,
    actor: ActorInput,
    dto: CreateVenueDocumentDto,
  ): Promise<VenueDocumentItem> {
    const venue = await this.venues.findOne({ where: { id } });
    if (!venue) throw new NotFoundException('Venue not found');
    assertOwnerOrAdmin(actor, venue.ownerId);
    const url = dto.url.trim();
    if (!isAllowedPhotoUrl(url)) {
      throw new BadRequestException(
        'Venue document must be /uploads/ paths or https URLs',
      );
    }
    const doc = this.documents.create({
      venueId: id,
      type: dto.type,
      url,
      status: 'pending',
      note: null,
    });
    return this.toDocumentPublic(await this.documents.save(doc));
  }

  /**
   * DELETE /venues/:id/documents/:docId — hapus dokumen (API-W01).
   * Hanya owner venue / super_admin (403 lintas owner).
   * Dokumen tak ada / milik venue lain → 404.
   */
  async removeDocument(
    id: string,
    docId: string,
    actor: ActorInput,
  ): Promise<void> {
    const venue = await this.venues.findOne({ where: { id } });
    if (!venue) throw new NotFoundException('Venue not found');
    assertOwnerOrAdmin(actor, venue.ownerId);
    const doc = await this.documents.findOne({ where: { id: docId } });
    if (!doc || doc.venueId !== id) {
      throw new NotFoundException('Document not found');
    }
    await this.documents.remove(doc);
  }

  /**
   * POST /venues/:id/documents/:docId/verify — verifikasi admin (API-W01).
   * Khusus super_admin (guard di controller). Dokumen tak ada / milik
   * venue lain → 404.
   */
  async verifyDocument(
    id: string,
    docId: string,
    dto: VerifyVenueDocumentDto,
  ): Promise<VenueDocumentItem> {
    const venue = await this.venues.findOne({ where: { id } });
    if (!venue) throw new NotFoundException('Venue not found');
    const doc = await this.documents.findOne({ where: { id: docId } });
    if (!doc || doc.venueId !== id) {
      throw new NotFoundException('Document not found');
    }
    doc.status = dto.status;
    doc.note = dto.note?.trim() ? dto.note.trim() : null;
    return this.toDocumentPublic(await this.documents.save(doc));
  }

  toDocumentPublic(d: VenueDocument): VenueDocumentItem {
    return {
      id: d.id,
      venueId: d.venueId,
      type: d.type,
      url: d.url,
      status: d.status,
      note: d.note ?? null,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  }

  /** POST /venues/:id/approve — pending -> approved (khusus super_admin). */
  async approve(id: string, actorId?: string): Promise<VenueItem> {
    const venue = await this.venues.findOne({ where: { id } });
    if (!venue) throw new NotFoundException('Venue not found');
    if (venue.status !== 'pending') {
      throw new ConflictException('Only pending venues can be approved');
    }
    venue.status = 'approved';
    venue.rejectionReason = null;
    if (actorId) venue.updatedBy = actorId;
    await this.venues.save(venue);
    return this.mustLoad(id);
  }

  /** POST /venues/:id/reject — pending -> rejected + alasan (khusus super_admin). */
  async reject(id: string, reason?: string, actorId?: string): Promise<VenueItem> {
    const venue = await this.venues.findOne({ where: { id } });
    if (!venue) throw new NotFoundException('Venue not found');
    if (venue.status !== 'pending') {
      throw new ConflictException('Only pending venues can be rejected');
    }
    venue.status = 'rejected';
    venue.rejectionReason = reason?.trim() ? reason.trim() : null;
    if (actorId) venue.updatedBy = actorId;
    await this.venues.save(venue);
    return this.mustLoad(id);
  }

  /** POST /venues/:id/courts — tambah court (owner venue / super_admin). */
  async createCourt(
    venueId: string,
    actor: ActorInput,
    dto: CreateCourtDto,
  ): Promise<CourtItem> {
    const venue = await this.venues.findOne({ where: { id: venueId } });
    if (!venue) throw new NotFoundException('Venue not found');
    assertOwnerOrAdmin(actor, venue.ownerId);

    const court = this.courts.create({
      venueId,
      sport: dto.sport.trim(),
      name: dto.name.trim(),
      pricePerHour: dto.pricePerHour,
      openHours: dto.openHours ?? null,
      status: (dto.status ?? 'active') as CourtStatus,
    });
    return this.toCourtPublic(await this.courts.save(court));
  }

  /**
   * PATCH /venues/:id/courts/:courtId — ubah court (owner venue / super_admin).
   * AD-02: bila editor BUKAN admin dan venue induk sudah `approved` serta
   * payload menyentuh field sensitif (name, pricePerHour, openHours) →
   * change request `pending` (202 + CR id), court tetap data lama.
   * Admin / venue non-approved → langsung ubah.
   */
  async updateCourt(
    venueId: string,
    courtId: string,
    actor: ActorInput,
    dto: UpdateCourtDto,
  ): Promise<CourtItem | PendingChangeResponse> {
    const venue = await this.venues.findOne({ where: { id: venueId } });
    if (!venue) throw new NotFoundException('Venue not found');
    assertOwnerOrAdmin(actor, venue.ownerId);
    const court = await this.courts.findOne({ where: { id: courtId } });
    if (!court || court.venueId !== venueId) {
      throw new NotFoundException('Court not found');
    }

    const isAdmin = actor.role === 'super_admin';
    if (
      !isAdmin &&
      venue.status === 'approved' &&
      hasSensitiveKeys(dto as Record<string, unknown>, COURT_SENSITIVE_FIELDS)
    ) {
      const cr = await this.changeRequests.create({
        entityType: 'court',
        entityId: court.id,
        payload: buildCourtPayload(dto) as Record<string, unknown>,
        requestedBy: actor.id,
      });
      return toPendingChange(cr);
    }

    const patch = buildCourtPayload(dto);
    if (patch.sport !== undefined) court.sport = patch.sport;
    if (patch.name !== undefined) court.name = patch.name;
    if (patch.pricePerHour !== undefined) court.pricePerHour = patch.pricePerHour;
    if (patch.openHours !== undefined) court.openHours = patch.openHours;
    if (patch.status !== undefined) court.status = patch.status;
    court.updatedBy = actor.id;
    return this.toCourtPublic(await this.courts.save(court));
  }

  /**
   * GET /venues — publik, HANYA venue approved.
   * Filter sport + lingkaran geo, sort jarak (geo) / createdAt, pagination + meta.
   */
  async list(query: ListVenuesDto): Promise<{
    data: VenueItem[];
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
    query: ListVenuesDto,
    page: number,
    limit: number,
    useGeo: boolean,
    radius: number,
  ): Promise<{ data: VenueItem[]; meta: { page: number; limit: number; total: number } }> {
    const qb = this.venues
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.owner', 'owner')
      .leftJoinAndSelect('v.courts', 'courts')
      .where('v.status = :status', { status: 'approved' })
      .skip((page - 1) * limit)
      .take(limit);

    if (query.sport?.trim()) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM unnest(v.sports) AS s WHERE LOWER(s) = LOWER(:sport))',
        { sport: query.sport.trim() },
      );
    }
    if (useGeo) {
      qb.andWhere(
        'ST_DWithin(v.location, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :radius)',
        { lat: query.lat, lng: query.lng, radius },
      );
      qb.addSelect(
        'ST_Distance(v.location, ST_SetSRID(ST_MakePoint(:lngQ, :latQ), 4326)::geography)',
        'distanceMeters',
      ).setParameters({ latQ: query.lat, lngQ: query.lng });
      qb.orderBy('distanceMeters', 'ASC');
    } else {
      qb.orderBy('v.createdAt', 'ASC');
    }

    const [rows, total] = await qb.getManyAndCount();
    let distances: Array<number | null> = [];
    if (useGeo) {
      const raw = await qb.getRawMany<{ distanceMeters: string }>();
      distances = raw.map((r) =>
        r.distanceMeters == null ? null : Number(r.distanceMeters),
      );
    }
    return {
      data: rows.map((v, i) =>
        this.toPublic(
          v,
          useGeo && distances[i] != null ? Math.round(distances[i] as number) : undefined,
        ),
      ),
      meta: { page, limit, total },
    };
  }

  /** Fallback sqljs (e2e tanpa Postgres): filter + sort di memori. */
  private async listSqljs(
    query: ListVenuesDto,
    page: number,
    limit: number,
    useGeo: boolean,
    radius: number,
  ): Promise<{ data: VenueItem[]; meta: { page: number; limit: number; total: number } }> {
    const rows = await this.venues.find({
      relations: { owner: true, courts: true },
      order: { createdAt: 'ASC' },
    });
    const sport = query.sport?.trim().toLowerCase();

    const withDistance = rows
      .filter((v) => v.status === 'approved')
      .filter((v) => {
        if (sport) {
          const sports = (v.sports ?? []).map((s) => String(s).toLowerCase());
          if (!sports.includes(sport)) return false;
        }
        if (useGeo) {
          const d = haversineMeters(query.lat as number, query.lng as number, v.lat, v.lng);
          if (d > radius) return false;
        }
        return true;
      })
      .map((v) => ({
        venue: v,
        distance: useGeo
          ? haversineMeters(query.lat as number, query.lng as number, v.lat, v.lng)
          : null,
      }));

    if (useGeo) {
      withDistance.sort((a, b) => (a.distance as number) - (b.distance as number));
    }

    const total = withDistance.length;
    const slice = withDistance.slice((page - 1) * limit, page * limit);
    return {
      data: slice.map(({ venue, distance }) =>
        this.toPublic(venue, distance != null ? Math.round(distance) : undefined),
      ),
      meta: { page, limit, total },
    };
  }

  /**
   * GET /admin/venues — semua status untuk CMS (khusus super_admin).
   * Filter status opsional; sort createdAt DESC (terbaru dulu).
   */
  async listForAdmin(status?: Venue['status']): Promise<{
    data: VenueItem[];
    meta: { total: number };
  }> {
    const rows = await this.venues.find({
      relations: { owner: true, courts: true },
      order: { createdAt: 'DESC' },
    });
    const filtered = status ? rows.filter((v) => v.status === status) : rows;
    return {
      data: filtered.map((v) => this.toPublic(v)),
      meta: { total: filtered.length },
    };
  }

  /**
   * GET /venues/:id — publik untuk venue approved; venue non-approved
   * disembunyikan (404) kecuali dilihat owner-nya / super_admin.
   * API-W01: `documents` + `legalitas` hanya disertakan untuk owner /
   * super_admin; publik tidak memuat kedua field tersebut.
   */
  async detail(id: string, actor?: ActorInput | null): Promise<VenueItem> {
    const venue = await this.venues.findOne({
      where: { id },
      relations: { owner: true, courts: true, documents: true },
    });
    if (!venue) throw new NotFoundException('Venue not found');
    if (venue.status !== 'approved') {
      if (!actor || !isOwnerOrAdmin(actor, venue.ownerId)) {
        throw new NotFoundException('Venue not found');
      }
    }
    const includeDocs = !!actor && isOwnerOrAdmin(actor, venue.ownerId);
    return this.toPublic(venue, undefined, includeDocs);
  }

  /** Baca ulang venue apa pun statusnya dengan relasi (hasil approve/reject). */
  private async mustLoad(id: string): Promise<VenueItem> {
    const venue = await this.venues.findOne({
      where: { id },
      relations: { owner: true, courts: true, documents: true },
    });
    if (!venue) throw new NotFoundException('Venue not found');
    return this.toPublic(venue, undefined, true);
  }

  /** Baca ulang venue milik owner/admin apa pun statusnya (hasil create/update). */
  private async mustDetail(id: string, actor: ActorInput): Promise<VenueItem> {
    const venue = await this.venues.findOne({
      where: { id },
      relations: { owner: true, courts: true, documents: true },
    });
    if (!venue) throw new NotFoundException('Venue not found');
    assertOwnerOrAdmin(actor, venue.ownerId);
    return this.toPublic(venue, undefined, true);
  }

  toPublic(v: Venue, distanceMeters?: number, includeDocs = false): VenueItem {
    const docs = includeDocs ? (v.documents ?? []) : undefined;
    return {
      id: v.id,
      name: v.name,
      address: v.address,
      lat: v.lat,
      lng: v.lng,
      sports: v.sports ?? [],
      photos: v.photos ?? [],
      owner: {
        id: v.owner?.id ?? v.ownerId,
        email: v.owner?.email ?? '',
        displayName: v.owner?.displayName ?? null,
      },
      status: v.status,
      rejectionReason: v.rejectionReason ?? null,
      updatedBy: v.updatedBy ?? null,
      courts: (v.courts ?? []).map((c) => this.toCourtPublic(c)),
      ...(distanceMeters !== undefined ? { distanceMeters } : {}),
      ...(docs !== undefined
        ? {
            documents: docs.map((d) => this.toDocumentPublic(d)),
            legalitas: computeLegalitas(docs),
          }
        : {}),
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    };
  }

  toCourtPublic(c: Court): CourtItem {
    return {
      id: c.id,
      venueId: c.venueId,
      sport: c.sport,
      name: c.name,
      pricePerHour: c.pricePerHour,
      openHours: c.openHours ?? null,
      status: c.status,
      updatedBy: c.updatedBy ?? null,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }

  /**
   * Turunkan kolom `location` dari lat/lng agar queryable spasial.
   * Postgres: geography(Point,4326) via PostGIS. sqljs-test: WKT string.
   */
  private async syncLocation(venueId: string, lat: number, lng: number): Promise<void> {
    if (this.isPostgres) {
      await this.venues.query(
        'UPDATE venues SET location = ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography WHERE id = $3',
        [lat, lng, venueId],
      );
    } else {
      await this.venues.query('UPDATE venues SET location = ? WHERE id = ?', [
        `POINT(${lng} ${lat})`,
        venueId,
      ]);
    }
  }
}

/** Trim, buang kosong, dedupe (case-insensitive) — khusus kolom foto venue. */
export function normalizePhotos(input: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    const s = String(raw ?? '').trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/** Batas foto venue (ST-01). */
export const MAX_VENUE_PHOTOS = 5;

/** Normalisasi + validasi URL foto venue (maks 5, /uploads/ atau https). */
export function validateVenuePhotos(input: string[]): string[] {
  assertPhotoUrls(input, MAX_VENUE_PHOTOS, 'Venue photos');
  return input;
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
