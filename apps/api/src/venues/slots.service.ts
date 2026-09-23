import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import type { ActorInput } from '../auth/ownership';
import { assertOwnerOrAdmin } from '../auth/ownership';
import { Court } from './court.entity';
import { CreateBlockDto } from './dto/create-block.dto';
import { HoldSlotDto } from './dto/hold-slot.dto';
import { SlotBlock } from './slot-block.entity';
import { SlotClaim } from './slot-claim.entity';
import { Venue } from './venue.entity';

/** Durasi slot default 60 menit (keputusan PO, BK-02). */
export const SLOT_DURATION_MINUTES = 60;
/** Hold kedaluwarsa 10 menit setelah dibuat (BK-02). */
export const HOLD_TTL_MS = 10 * 60 * 1000;

/**
 * Status slot availability. `blocked` (API-W06) = ditutup owner via
 * POST /courts/:id/blocks — SENGAJA beda dari `booked` agar statistik
 * okupansi (API-W05, dihitung dari booking) tetap jujur.
 */
export type SlotStatus = 'free' | 'held' | 'booked' | 'blocked';

export interface SlotAvailability {
  date: string;
  start: string;
  end: string;
  startMinute: number;
  endMinute: number;
  status: SlotStatus;
}

export interface HoldItem {
  id: string;
  courtId: string;
  date: string;
  start: string;
  end: string;
  startMinute: number;
  endMinute: number;
  status: 'held';
  holderId: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface BlockItem {
  id: string;
  courtId: string;
  date: string;
  start: string;
  end: string;
  startMinute: number;
  endMinute: number;
  reason: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class SlotsService {
  constructor(
    @InjectRepository(Court)
    private readonly courts: Repository<Court>,
    @InjectRepository(Venue)
    private readonly venues: Repository<Venue>,
    @InjectRepository(SlotClaim)
    private readonly claims: Repository<SlotClaim>,
    @InjectRepository(SlotBlock)
    private readonly blocks: Repository<SlotBlock>,
  ) {}

  /**
   * Mutex in-process per slot (wajib untuk sqljs-test yang tidak punya
   * row-lock; di Postgres ada perlindungan tambahan SELECT FOR UPDATE +
   * unique constraint di dalam transaksi sehingga aman antar-proses juga).
   * Lock Redis opsional (BK-03, multi-instance) — belum dibutuhkan di sini.
   */
  private readonly slotLocks = new Map<string, Promise<void>>();

  private async withSlotLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.slotLocks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const mine = new Promise<void>((res) => {
      release = res;
    });
    const tail = prev.then(() => mine);
    this.slotLocks.set(key, tail);
    await prev;
    try {
      return await fn();
    } finally {
      release();
      if (this.slotLocks.get(key) === tail) this.slotLocks.delete(key);
    }
  }

  private get isPostgres(): boolean {
    return this.claims.manager.connection.options.type === 'postgres';
  }

  /**
   * GET /courts/:id/availability — generate slot dari courts.open_hours
   * untuk tanggal tsb, lalu tandai free/held/booked dari slot_claims +
   * blocked dari slot_blocks (API-W06).
   * Hold kedaluwarsa (expires_at <= now) dibaca sebagai free.
   * Klaim aktif (held-valid/confirmed) MENANG atas blokir — slot yang sudah
   * terbooking tetap terbaca booked (bukan blocked) agar booking berbayar
   * tidak hilang dari pandangan; blokir tetap menutup slot bebas lain dalam
   * rentangnya dan menolak klaim baru.
   */
  async availability(
    courtId: string,
    date: string,
  ): Promise<{ courtId: string; date: string; slots: SlotAvailability[] }> {
    assertValidDate(date);
    const court = await this.courts.findOne({ where: { id: courtId } });
    if (!court) throw new NotFoundException('Court not found');

    const generated = generateSlotsForDate(court.openHours, date);
    if (generated.length === 0) return { courtId, date, slots: [] };

    const rows = await this.claims.find({
      where: { courtId, date },
    });
    const byStart = new Map<number, SlotClaim>();
    for (const r of rows) byStart.set(r.startMinute, r);

    const blocks = await this.blocks.find({ where: { courtId, date } });

    const now = Date.now();
    const slots: SlotAvailability[] = generated.map((g) => {
      const claimStatus = claimToSlotStatus(byStart.get(g.startMinute), now);
      if (claimStatus !== 'free') return { ...g, status: claimStatus };
      const blocked = blocks.some(
        (b) => g.startMinute < b.endMinute && b.startMinute < g.endMinute,
      );
      return { ...g, status: blocked ? 'blocked' : 'free' };
    });
    return { courtId, date, slots };
  }

  /**
   * POST /courts/:id/hold — klaim transaksional anti-race:
   * mutex in-process + SELECT FOR UPDATE (Postgres) + unique-catch → 409.
   * Slot yang sudah confirmed (booking BK-03), masih di-hold valid, atau
   * diblokir owner (API-W06) ditolak 409; released / held-kedaluwarsa boleh
   * diklaim ulang.
   */
  async hold(
    courtId: string,
    actor: ActorInput,
    dto: HoldSlotDto,
  ): Promise<HoldItem> {
    assertValidDate(dto.date);
    const startMinute = resolveStartMinute(dto);
    const duration = dto.durationMinutes ?? SLOT_DURATION_MINUTES;
    const endMinute = startMinute + duration;
    if (endMinute > 24 * 60) {
      throw new BadRequestException('Slot exceeds 24:00');
    }

    const court = await this.courts.findOne({ where: { id: courtId } });
    if (!court) throw new NotFoundException('Court not found');
    if (court.status !== 'active') {
      throw new ConflictException('Court is not active');
    }

    // Slot harus sesuai open_hours hari itu (durasi 60 mnt default).
    const generated = generateSlotsForDate(court.openHours, dto.date);
    const match = generated.find(
      (g) => g.startMinute === startMinute && g.endMinute === endMinute,
    );
    if (!match) {
      throw new BadRequestException(
        'Slot is outside court open hours for this date',
      );
    }

    const lockKey = `${courtId}:${dto.date}:${startMinute}`;
    return this.withSlotLock(lockKey, () =>
      this.claims.manager.transaction(async (mgr) => {
        const claimRepo = mgr.getRepository(SlotClaim);

        // API-W06: slot yang overlap blokir owner → 409 (sama seperti booked).
        await assertSlotNotBlocked(mgr, courtId, dto.date, startMinute, endMinute);

        const existing = this.isPostgres
          ? await claimRepo.findOne({
              where: { courtId, date: dto.date, startMinute },
              lock: { mode: 'pessimistic_write' },
            })
          : await claimRepo.findOne({
              where: { courtId, date: dto.date, startMinute },
            });

        const now = new Date();
        if (existing) {
          if (existing.status === 'confirmed') {
            throw new ConflictException('Slot is already booked');
          }
          if (
            existing.status === 'held' &&
            existing.expiresAt &&
            new Date(existing.expiresAt).getTime() > now.getTime()
          ) {
            throw new ConflictException('Slot is already held');
          }
          // released / held-kedaluwarsa: daur ulang baris yang sama
          // (unique court,date,start tetap terjaga, riwayat tidak menumpuk).
          existing.status = 'held';
          existing.holderId = actor.id;
          existing.endMinute = endMinute;
          existing.expiresAt = new Date(now.getTime() + HOLD_TTL_MS);
          const saved = await claimRepo.save(existing);
          return toHoldItem(saved);
        }

        const claim = claimRepo.create({
          courtId,
          date: dto.date,
          startMinute,
          endMinute,
          status: 'held',
          holderId: actor.id,
          expiresAt: new Date(now.getTime() + HOLD_TTL_MS),
        });
        try {
          const saved = await claimRepo.save(claim);
          return toHoldItem(saved);
        } catch {
          // Balapan antar-proses lolos dari cek di atas: unique
          // (court,date,start) melarang ganda → baca ulang untuk 409 tepat.
          const raced = await claimRepo.findOne({
            where: { courtId, date: dto.date, startMinute },
          });
          if (!raced) throw new ConflictException('Slot is already held');
          if (raced.status === 'confirmed') {
            throw new ConflictException('Slot is already booked');
          }
          throw new ConflictException('Slot is already held');
        }
      }),
    );
  }

  /**
   * POST /holds/:id/release — lepas hold milik sendiri.
   * Venue owner / super_admin boleh melepas hold orang lain.
   * Idempotent: hold yang sudah released/expired → 200 ok.
   * confirmed (milik booking BK-03) tidak bisa di-release dari sini → 409.
   */
  async release(
    holdId: string,
    actor: ActorInput,
  ): Promise<{ ok: true; id: string; status: string }> {
    const claim = await this.claims.findOne({ where: { id: holdId } });
    if (!claim) throw new NotFoundException('Hold not found');
    if (claim.status === 'confirmed') {
      throw new ConflictException('Confirmed booking cannot be released here');
    }
    if (claim.status !== 'held') {
      return { ok: true, id: claim.id, status: 'released' };
    }

    if (claim.holderId !== actor.id) {
      const court = await this.courts.findOne({
        where: { id: claim.courtId },
      });
      const venue = court
        ? await this.venues.findOne({ where: { id: court.venueId } })
        : null;
      const ownerId = venue?.ownerId;
      const allowed =
        actor.role === 'super_admin' ||
        (ownerId != null && actor.id === ownerId);
      if (!allowed) {
        throw new ForbiddenException('Forbidden: not the hold owner');
      }
    }

    claim.status = 'released';
    await this.claims.save(claim);
    return { ok: true, id: claim.id, status: 'released' };
  }

  /**
   * POST /courts/:id/blocks (API-W06, owner venue / super_admin) — tutup slot.
   * Rentang boleh mencakup >1 slot generate; minimal overlap 1 slot generate
   * (selain itu 400). Duplikat exact (court,date,start) → 409.
   * Blokir atas slot yang sudah terbooking tetap tersimpan (menutup slot
   * setelah booking tsb batal/kedaluwarsa); availability memprioritaskan
   * klaim aktif (tetap booked) di atas blokir.
   */
  async createBlock(
    courtId: string,
    actor: ActorInput,
    dto: CreateBlockDto,
  ): Promise<BlockItem> {
    assertValidDate(dto.date);
    const startMinute = resolveBlockStart(dto);
    const duration = dto.durationMinutes ?? SLOT_DURATION_MINUTES;
    const endMinute = startMinute + duration;
    if (endMinute > 24 * 60) {
      throw new BadRequestException('Slot exceeds 24:00');
    }

    const court = await this.courts.findOne({ where: { id: courtId } });
    if (!court) throw new NotFoundException('Court not found');
    const venue = await this.venues.findOne({ where: { id: court.venueId } });
    if (!venue) throw new NotFoundException('Venue not found');
    assertOwnerOrAdmin(actor, venue.ownerId);

    const generated = generateSlotsForDate(court.openHours, dto.date);
    const overlaps = generated.some(
      (g) => g.startMinute < endMinute && startMinute < g.endMinute,
    );
    if (!overlaps) {
      throw new BadRequestException(
        'Block is outside court open hours for this date',
      );
    }

    try {
      const saved = await this.blocks.save(
        this.blocks.create({
          courtId,
          date: dto.date,
          startMinute,
          endMinute,
          reason: dto.reason?.trim() ? dto.reason.trim() : null,
          createdBy: actor.id,
        }),
      );
      return toBlockItem(saved);
    } catch {
      throw new ConflictException('Slot is already blocked');
    }
  }

  /**
   * GET /courts/:id/blocks (API-W06, owner venue / super_admin) — daftar blokir.
   * Filter `date` opsional; urut tanggal + jam mulai ASC.
   */
  async listBlocks(
    courtId: string,
    actor: ActorInput,
    date?: string,
  ): Promise<{ data: BlockItem[]; meta: { total: number } }> {
    if (date !== undefined) assertValidDate(date);
    const court = await this.courts.findOne({ where: { id: courtId } });
    if (!court) throw new NotFoundException('Court not found');
    const venue = await this.venues.findOne({ where: { id: court.venueId } });
    if (!venue) throw new NotFoundException('Venue not found');
    assertOwnerOrAdmin(actor, venue.ownerId);

    const rows = await this.blocks.find({
      where: date ? { courtId, date } : { courtId },
      order: { date: 'ASC', startMinute: 'ASC' },
    });
    return { data: rows.map(toBlockItem), meta: { total: rows.length } };
  }

  /**
   * DELETE /courts/:id/blocks/:blockId (API-W06, owner venue / super_admin).
   * Blokir milik court lain / tak ada → 404; lintas owner → 403.
   */
  async deleteBlock(
    courtId: string,
    blockId: string,
    actor: ActorInput,
  ): Promise<{ ok: true; id: string }> {
    const court = await this.courts.findOne({ where: { id: courtId } });
    if (!court) throw new NotFoundException('Court not found');
    const venue = await this.venues.findOne({ where: { id: court.venueId } });
    if (!venue) throw new NotFoundException('Venue not found');
    assertOwnerOrAdmin(actor, venue.ownerId);

    const block = await this.blocks.findOne({ where: { id: blockId } });
    if (!block || block.courtId !== courtId) {
      throw new NotFoundException('Block not found');
    }
    await this.blocks.remove(block);
    return { ok: true, id: blockId };
  }

  /**
   * Klaim slot sebagai CONFIRMED untuk booking BK-03 (penggunaan internal).
   * Dipakai `BookingsService.create`: slot langsung confirmed agar tidak bisa
   * diklaim pihak lain selama menunggu pembayaran (pending 30 mnt) maupun
   * setelah lunas. Webhook expire/cancel + job expiry melepasnya kembali.
   *
   * Aturan konflik (→ 409): confirmed apa pun pemiliknya; held-valid milik
   * orang lain. Held-valid milik holder yang sama di-upgrade ke confirmed;
   * released / held-kedaluwarsa didaur ulang menjadi confirmed.
   */
  async confirmSlot(
    courtId: string,
    date: string,
    startMinute: number,
    endMinute: number,
    holderId: string,
  ): Promise<SlotClaim> {
    const lockKey = `${courtId}:${date}:${startMinute}`;
    return this.withSlotLock(lockKey, () =>
      this.claims.manager.transaction(async (mgr) => {
        const claimRepo = mgr.getRepository(SlotClaim);

        // API-W06: blokir owner menolak klaim booking sama seperti booked.
        await assertSlotNotBlocked(mgr, courtId, date, startMinute, endMinute);

        const existing = this.isPostgres
          ? await claimRepo.findOne({
              where: { courtId, date, startMinute },
              lock: { mode: 'pessimistic_write' },
            })
          : await claimRepo.findOne({
              where: { courtId, date, startMinute },
            });

        const now = new Date();
        if (existing) {
          if (existing.status === 'confirmed') {
            throw new ConflictException('Slot is already booked');
          }
          if (existing.status === 'held' && isValidHold(existing, now)) {
            if (existing.holderId !== holderId) {
              throw new ConflictException('Slot is already held');
            }
            // Hold milik sendiri (mis. via POST /courts/:id/hold) → upgrade.
            existing.status = 'confirmed';
            existing.endMinute = endMinute;
            existing.expiresAt = null;
            return claimRepo.save(existing);
          }
          existing.status = 'confirmed';
          existing.holderId = holderId;
          existing.endMinute = endMinute;
          existing.expiresAt = null;
          return claimRepo.save(existing);
        }

        const claim = claimRepo.create({
          courtId,
          date,
          startMinute,
          endMinute,
          status: 'confirmed',
          holderId,
          expiresAt: null,
        });
        try {
          return await claimRepo.save(claim);
        } catch {
          const raced = await claimRepo.findOne({
            where: { courtId, date, startMinute },
          });
          if (!raced) throw new ConflictException('Slot is already held');
          if (raced.status === 'confirmed') {
            throw new ConflictException('Slot is already booked');
          }
          throw new ConflictException('Slot is already held');
        }
      }),
    );
  }

  /**
   * Lepas klaim apa pun statusnya (held/confirmed) → released.
   * Penggunaan internal BK-03 (webhook expire/cancel, expiry job, cancel user).
   * Idempotent: tanpa baris / sudah released → no-op.
   */
  async releaseClaimInternal(claimId: string): Promise<void> {
    const claim = await this.claims.findOne({ where: { id: claimId } });
    if (!claim || claim.status === 'released') return;
    claim.status = 'released';
    await this.claims.save(claim);
  }

  /**
   * Pastikan klaim kembali confirmed (dipakai saat webhook settlement/capture:
   * klaim normalnya sudah confirmed sejak booking dibuat; ini pengaman bila
   * statusnya sempat berubah di luar alur normal).
   * Idempotent: tanpa baris → no-op (booking tetap ditandai paid).
   */
  async ensureConfirmedInternal(
    claimId: string,
    holderId: string,
  ): Promise<void> {
    const claim = await this.claims.findOne({ where: { id: claimId } });
    if (!claim || claim.status === 'confirmed') return;
    claim.status = 'confirmed';
    claim.holderId = holderId;
    claim.expiresAt = null;
    await this.claims.save(claim);
  }
}

/** Validasi kalender YYYY-MM-DD (bukan sekadar regex). */
export function assertValidDate(date: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new BadRequestException('date must be YYYY-MM-DD');
  }
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    throw new BadRequestException('date is not a valid calendar date');
  }
}

/** Terima `start: "HH:MM"` atau `startMinute`; minimal satu wajib ada. */
export function resolveStartMinute(dto: HoldSlotDto): number {
  if (dto.startMinute !== undefined) return dto.startMinute;
  if (dto.start !== undefined) return parseHHMM(dto.start);
  throw new BadRequestException('Either start or startMinute is required');
}

/** Sama seperti hold, untuk DTO blokir (API-W06). */
export function resolveBlockStart(dto: CreateBlockDto): number {
  if (dto.startMinute !== undefined) return dto.startMinute;
  if (dto.start !== undefined) return parseHHMM(dto.start);
  throw new BadRequestException('Either start or startMinute is required');
}

/**
 * Tolak klaim (hold/confirm) yang overlap blokir owner → 409.
 * Dipakai di dalam transaksi klaim agar cek + tulis atomik.
 */
async function assertSlotNotBlocked(
  mgr: EntityManager,
  courtId: string,
  date: string,
  startMinute: number,
  endMinute: number,
): Promise<void> {
  const blocks = await mgr
    .getRepository(SlotBlock)
    .find({ where: { courtId, date } });
  const hit = blocks.some(
    (b) => startMinute < b.endMinute && b.startMinute < endMinute,
  );
  if (hit) throw new ConflictException('Slot is blocked');
}

export function parseHHMM(s: string): number {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(s);
  if (!m) throw new BadRequestException('start must be HH:MM (00:00-23:59)');
  return Number(m[1]) * 60 + Number(m[2]);
}

export function toHHMM(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function toHoldItem(c: SlotClaim): HoldItem {
  return {
    id: c.id,
    courtId: c.courtId,
    date: c.date,
    start: toHHMM(c.startMinute),
    end: toHHMM(c.endMinute),
    startMinute: c.startMinute,
    endMinute: c.endMinute,
    status: 'held',
    holderId: c.holderId,
    expiresAt: c.expiresAt as Date,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

function toBlockItem(b: SlotBlock): BlockItem {
  return {
    id: b.id,
    courtId: b.courtId,
    date: b.date,
    start: toHHMM(b.startMinute),
    end: toHHMM(b.endMinute),
    startMinute: b.startMinute,
    endMinute: b.endMinute,
    reason: b.reason ?? null,
    createdBy: b.createdBy ?? null,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}

/** True bila klaim masih berstatus held dan belum kedaluwarsa. */
export function isValidHold(claim: SlotClaim, now: Date): boolean {
  return (
    claim.status === 'held' &&
    claim.expiresAt != null &&
    new Date(claim.expiresAt).getTime() > now.getTime()
  );
}

/** held-valid → held; confirmed → booked; sisanya (termasuk expired) → free. */
export function claimToSlotStatus(
  claim: SlotClaim | undefined,
  nowMs: number,
): SlotStatus {
  if (!claim) return 'free';
  if (claim.status === 'confirmed') return 'booked';
  if (claim.status === 'released') return 'free';
  if (
    claim.status === 'held' &&
    claim.expiresAt &&
    new Date(claim.expiresAt).getTime() > nowMs
  ) {
    return 'held';
  }
  return 'free';
}

/**
 * Generate slot 60-menit dari open_hours untuk tanggal tsb.
 * open_hours: `{ mon: ["08:00-22:00"], ... }` (key case-insensitive;
 * nama panjang + `daily`/`all` didukung; value string tunggal juga bisa).
 * Tanpa jam di hari itu → [] (bukan error).
 */
export function generateSlotsForDate(
  openHours: Record<string, unknown> | null | undefined,
  date: string,
  durationMinutes = SLOT_DURATION_MINUTES,
): Array<{
  date: string;
  start: string;
  end: string;
  startMinute: number;
  endMinute: number;
}> {
  if (!openHours || typeof openHours !== 'object') return [];
  const [y, m, d] = date.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun
  const ranges = rangesForWeekday(openHours, weekday);
  const out: Array<{
    date: string;
    start: string;
    end: string;
    startMinute: number;
    endMinute: number;
  }> = [];
  for (const [from, to] of ranges) {
    for (let s = from; s + durationMinutes <= to; s += durationMinutes) {
      out.push({
        date,
        start: toHHMM(s),
        end: toHHMM(s + durationMinutes),
        startMinute: s,
        endMinute: s + durationMinutes,
      });
    }
  }
  out.sort((a, b) => a.startMinute - b.startMinute);
  return out;
}

const WEEKDAY_KEYS: string[][] = [
  ['sun', 'sunday', 'minggu', '0'],
  ['mon', 'monday', 'senin', '1'],
  ['tue', 'tues', 'tuesday', 'selasa', '2'],
  ['wed', 'wednesday', 'rabu', '3'],
  ['thu', 'thur', 'thurs', 'thursday', 'kamis', '4'],
  ['fri', 'friday', 'jumat', '5'],
  ['sat', 'saturday', 'sabtu', '6'],
];

function rangesForWeekday(
  openHours: Record<string, unknown>,
  weekday: number,
): Array<[number, number]> {
  const lowered: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(openHours)) {
    lowered[String(k).trim().toLowerCase()] = v;
  }
  const candidates: unknown[] = [];
  for (const alias of WEEKDAY_KEYS[weekday]) {
    if (lowered[alias] !== undefined) candidates.push(lowered[alias]);
  }
  // Fallback harian bila hari spesifik tidak ada.
  for (const alias of ['daily', 'everyday', 'all', 'default']) {
    if (candidates.length === 0 && lowered[alias] !== undefined) {
      candidates.push(lowered[alias]);
    }
  }
  const ranges: Array<[number, number]> = [];
  for (const c of candidates) {
    const list = Array.isArray(c) ? c : [c];
    for (const item of list) {
      const parsed = parseRange(String(item ?? ''));
      if (parsed) ranges.push(parsed);
    }
  }
  return ranges;
}

function parseRange(s: string): [number, number] | null {
  const m = /^\s*([01]\d|2[0-3]):([0-5]\d)\s*-\s*([01]\d|2[0-3]):([0-5]\d)\s*$/.exec(
    s,
  );
  if (!m) return null;
  const from = Number(m[1]) * 60 + Number(m[2]);
  const to = Number(m[3]) * 60 + Number(m[4]);
  if (to <= from) return null;
  return [from, to];
}
