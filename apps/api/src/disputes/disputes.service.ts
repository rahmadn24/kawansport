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
 * Dispute center (API-W02).
 * - User: create untuk dirinya + list miliknya (`GET /disputes/me`).
 * - Super_admin: list semua (+ filter status), investigate, resolve.
 *
 * Aturan transisi: `investigating` hanya dari `open`; `resolved`/`rejected`
 * hanya dari `open`/`investigating`; selain itu 409.
 * TODO: resolve dengan refund otomatis di luar scope API-W02 — bila
 * dibutuhkan, tambahkan aksi refund terpisah (reversal Midtrans / poin)
 * dengan auditnya sendiri, jangan implisit di resolve.
 */
@Injectable()
export class DisputesService {
  constructor(
    @InjectRepository(Dispute)
    private readonly disputes: Repository<Dispute>,
  ) {}

  /** POST /disputes — buat laporan untuk diri sendiri. */
  async create(
    actor: RequestUser,
    dto: CreateDisputeDto,
  ): Promise<DisputeItem> {
    if (!dto.targetId.trim()) {
      throw new BadRequestException('targetId must be non-empty');
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
