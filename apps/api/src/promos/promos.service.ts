import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePromoDto } from './dto/create-promo.dto';
import { UpdatePromoDto } from './dto/update-promo.dto';
import { Promo } from './promo.entity';

export interface PromoItem {
  id: string;
  title: string;
  imageUrl: string;
  link: string | null;
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class PromosService {
  constructor(
    @InjectRepository(Promo)
    private readonly promos: Repository<Promo>,
  ) {}

  /** POST /promos — buat banner (khusus super_admin, guard di controller). */
  async create(dto: CreatePromoDto): Promise<PromoItem> {
    const { startsAt, endsAt } = this.parsePeriod(dto.startsAt, dto.endsAt);
    const promo = this.promos.create({
      title: dto.title.trim(),
      imageUrl: dto.imageUrl.trim(),
      link: dto.link?.trim() ? dto.link.trim() : null,
      active: dto.active ?? true,
      startsAt,
      endsAt,
    });
    return this.toPublic(await this.promos.save(promo));
  }

  /**
   * GET /promos — publik: hanya banner `active` DAN dalam periode tayang.
   * `all=true` (khusus super_admin, dicek di controller): semua banner
   * apa pun status/periode, urut terbaru dulu (untuk CMS kelola).
   */
  async list(all: boolean): Promise<{
    data: PromoItem[];
    meta: { total: number };
  }> {
    const rows = await this.promos.find({ order: { createdAt: 'DESC' } });
    const visible = all ? rows : rows.filter((p) => isLive(p, new Date()));
    return { data: visible.map((p) => this.toPublic(p)), meta: { total: visible.length } };
  }

  /** PATCH /promos/:id — ubah parsial (khusus super_admin). */
  async update(id: string, dto: UpdatePromoDto): Promise<PromoItem> {
    const promo = await this.promos.findOne({ where: { id } });
    if (!promo) throw new NotFoundException('Promo not found');
    if (dto.title !== undefined) promo.title = dto.title.trim();
    if (dto.imageUrl !== undefined) promo.imageUrl = dto.imageUrl.trim();
    if (dto.link !== undefined) {
      promo.link = dto.link?.trim() ? dto.link.trim() : null;
    }
    if (dto.active !== undefined) promo.active = dto.active;
    // Periode: gabungkan nilai baru + lama lalu validasi ulang agar
    // startsAt <= endsAt tetap terjaga saat update parsial.
    const nextStarts = dto.startsAt !== undefined ? dto.startsAt : toISOorUndefined(promo.startsAt);
    const nextEnds = dto.endsAt !== undefined ? dto.endsAt : toISOorUndefined(promo.endsAt);
    const { startsAt, endsAt } = this.parsePeriod(nextStarts, nextEnds);
    promo.startsAt = startsAt;
    promo.endsAt = endsAt;
    return this.toPublic(await this.promos.save(promo));
  }

  /** DELETE /promos/:id — hapus permanen (khusus super_admin). */
  async remove(id: string): Promise<void> {
    const promo = await this.promos.findOne({ where: { id } });
    if (!promo) throw new NotFoundException('Promo not found');
    await this.promos.remove(promo);
  }

  private parsePeriod(
    startsAt?: string,
    endsAt?: string,
  ): { startsAt: Date | null; endsAt: Date | null } {
    const start = startsAt ? new Date(startsAt) : null;
    const end = endsAt ? new Date(endsAt) : null;
    if (start && Number.isNaN(start.getTime())) {
      throw new BadRequestException('startsAt must be a valid ISO date');
    }
    if (end && Number.isNaN(end.getTime())) {
      throw new BadRequestException('endsAt must be a valid ISO date');
    }
    if (start && end && start.getTime() > end.getTime()) {
      throw new BadRequestException('startsAt must not be after endsAt');
    }
    return { startsAt: start, endsAt: end };
  }

  toPublic(p: Promo): PromoItem {
    return {
      id: p.id,
      title: p.title,
      imageUrl: p.imageUrl,
      link: p.link ?? null,
      active: p.active,
      startsAt: p.startsAt ?? null,
      endsAt: p.endsAt ?? null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }
}

/**
 * Banner tayang bila `active` DAN sekarang di dalam jendela
 * [startsAt, endsAt] (batas null = terbuka). Batas inklusif.
 */
export function isLive(p: Pick<Promo, 'active' | 'startsAt' | 'endsAt'>, now: Date): boolean {
  if (!p.active) return false;
  const t = now.getTime();
  if (p.startsAt && new Date(p.startsAt).getTime() > t) return false;
  if (p.endsAt && new Date(p.endsAt).getTime() < t) return false;
  return true;
}

function toISOorUndefined(d: Date | null | undefined): string | undefined {
  if (!d) return undefined;
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? undefined : t.toISOString();
}
