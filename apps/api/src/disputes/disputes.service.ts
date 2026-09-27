import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { RequestUser } from '../auth/jwt-auth.guard';
import { MatchResult } from '../elo/match-result.entity';
import { Dispute } from './dispute.entity';
import type { DisputeStatus } from './dispute.entity';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';

export interface DisputeItem {
  id: string;
  reporterId: string;
  targetType: string;
  targetId: string;
  category: string;
  description: string;
  status: DisputeStatus;
  resolution: string | null;
  resolvedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Dispute center (API-W02 + EL-05: `targetType` `match`).
 * - User: create untuk dirinya + list miliknya (`GET /disputes/me`).
 * - Super_admin: list semua (+ filter status), investigate, resolve.
 *
 * Aturan transisi: `investigating` hanya dari `open`; `resolved`/`rejected`
 * hanya dari `open`/`investigating`; selain itu 409.
 * EL-05 (match): `POST /disputes` dengan `targetType: 'match'` merujuk id
 * `MatchResult` (tanpa FK keras — pola yang sama dengan target lain):
 * targetId wajib UUID match yang ada (else 400/404), pelapor wajib pemain
 * match tsb atau super_admin (else 403), dan match `pending`/`confirmed`
 * otomatis menjadi `disputed` (freeze; `cancelled` → 409, `disputed` →
 * no-op). Tautan balik = `targetType/targetId` (TANPA kolom `disputeId`
 * di match — paling sedikit duplikasi, konsisten pola existing).
 * Penutupan DUA LANGKAH (kontrak resolve tidak diubah): admin resolve
 * tiket via `POST /disputes/:id/resolve` + putusan match via
 * `POST /matches/:id/resolve-dispute` (`confirm`/`cancel`).
 * TODO: resolve dengan refund otomatis di luar scope API-W02 — bila
 * dibutuhkan, tambahkan aksi refund terpisah (reversal Midtrans / poin)
 * dengan auditnya sendiri, jangan implisit di resolve.
 */
@Injectable()
export class DisputesService {
  constructor(
    @InjectRepository(Dispute)
    private readonly disputes: Repository<Dispute>,
    @InjectRepository(MatchResult)
    private readonly matches: Repository<MatchResult>,
  ) {}

  /**
   * POST /disputes — buat laporan untuk diri sendiri.
   * EL-05: `targetType: 'match'` → validasi + auto-dispute match (di atas).
   */
  async create(
    actor: RequestUser,
    dto: CreateDisputeDto,
  ): Promise<DisputeItem> {
    if (!dto.targetId.trim()) {
      throw new BadRequestException('targetId must be non-empty');
    }
    if (dto.targetType === 'match') {
      await this.linkMatchDispute(actor, dto.targetId.trim());
    }
    const dispute = await this.disputes.save(
      this.disputes.create({
        reporterId: actor.id,
        targetType: dto.targetType,
        targetId: dto.targetId.trim(),
        category: dto.category,
        description: dto.description,
        status: 'open',
      }),
    );
    return toDisputeItem(dispute);
  }

  /** GET /disputes/me — hanya laporan milik sendiri, terbaru dulu. */
  async listMine(actor: RequestUser): Promise<{ data: DisputeItem[] }> {
    const rows = await this.disputes.find({
      where: { reporterId: actor.id },
      order: { createdAt: 'DESC' },
    });
    return { data: rows.map(toDisputeItem) };
  }

  /** GET /disputes — semua laporan untuk CMS (khusus super_admin). */
  async listForAdmin(status?: string): Promise<{
    data: DisputeItem[];
    meta: { total: number };
  }> {
    const rows = await this.disputes.find({
      order: { createdAt: 'DESC' },
    });
    const filtered = status ? rows.filter((d) => d.status === status) : rows;
    return {
      data: filtered.map(toDisputeItem),
      meta: { total: filtered.length },
    };
  }

  /**
   * POST /disputes/:id/investigate — `open` → `investigating`.
   * Status lain → 409.
   */
  async investigate(id: string): Promise<DisputeItem> {
    const dispute = await this.findOrThrow(id);
    if (dispute.status !== 'open') {
      throw new ConflictException(
        `Only open disputes can be investigated (current: ${dispute.status})`,
      );
    }
    dispute.status = 'investigating';
    return toDisputeItem(await this.disputes.save(dispute));
  }

  /**
   * POST /disputes/:id/resolve — putusan akhir admin.
   * `resolved` wajib disertai `resolution` (400 bila kosong);
   * hanya dari `open`/`investigating` (409 bila sudah terminal).
   */
  async resolve(
    id: string,
    actor: RequestUser,
    dto: ResolveDisputeDto,
  ): Promise<DisputeItem> {
    const dispute = await this.findOrThrow(id);
    if (dispute.status !== 'open' && dispute.status !== 'investigating') {
      throw new ConflictException(
        `Only open/investigating disputes can be resolved (current: ${dispute.status})`,
      );
    }
    if (dto.status === 'resolved' && !dto.resolution?.trim()) {
      throw new BadRequestException(
        'resolution is required when resolving as resolved',
      );
    }
    dispute.status = dto.status;
    dispute.resolution = dto.resolution?.trim() ? dto.resolution : null;
    dispute.resolvedBy = actor.id;
    return toDisputeItem(await this.disputes.save(dispute));
  }

  private async findOrThrow(id: string): Promise<Dispute> {
    const dispute = await this.disputes.findOne({ where: { id } });
    if (!dispute) throw new NotFoundException('Dispute not found');
    return dispute;
  }

  /**
   * EL-05: validasi + auto-dispute untuk `targetType: 'match'`.
   * UUID invalid → 400; match tak ada → 404; pelapor bukan pemain (dan
   * bukan super_admin) → 403; match `cancelled` → 409.
   */
  private async linkMatchDispute(
    actor: RequestUser,
    matchId: string,
  ): Promise<void> {
    if (!UUID_RE.test(matchId)) {
      throw new BadRequestException(
        'targetId must be a match UUID when targetType is match',
      );
    }
    const match = await this.matches.findOne({ where: { id: matchId } });
    if (!match) throw new NotFoundException('Match not found');
    const teamA = asStringArray(match.teamA);
    const teamB = asStringArray(match.teamB);
    if (
      actor.role !== 'super_admin' &&
      !teamA.includes(actor.id) &&
      !teamB.includes(actor.id)
    ) {
      throw new ForbiddenException('Only players of this match can dispute it');
    }
    if (match.status === 'cancelled') {
      throw new ConflictException('Cannot dispute a cancelled match');
    }
    if (match.status === 'pending' || match.status === 'confirmed') {
      match.status = 'disputed';
      await this.matches.save(match);
    }
  }
}

export function assertReporterOrAdmin(
  actor: RequestUser,
  reporterId: string,
): void {
  if (actor.role === 'super_admin') return;
  if (actor.id === reporterId) return;
  throw new ForbiddenException("Forbidden: not the reporter's dispute");
}

export function toDisputeItem(d: Dispute): DisputeItem {
  return {
    id: d.id,
    reporterId: d.reporterId,
    targetType: d.targetType,
    targetId: d.targetId,
    category: d.category,
    description: d.description,
    status: d.status,
    resolution: d.resolution ?? null,
    resolvedBy: d.resolvedBy ?? null,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

/** UUID v4/umum (validasi ringan target match — kecocokan penuh di DB). */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Kolom array bisa null (simple-json sqljs) → normalisasi ke []. */
function asStringArray(value: string[] | null | undefined): string[] {
  return Array.isArray(value) ? value : [];
}
