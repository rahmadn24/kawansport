import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Badge, type BadgeKind } from './badge.entity';

export interface BadgeItem {
  id: string;
  userId: string;
  kind: BadgeKind;
  refId: string | null;
  awardedAt: Date;
}

@Injectable()
export class BadgesService {
  constructor(
    @InjectRepository(Badge)
    private readonly badges: Repository<Badge>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  /**
   * Berikan badge (idempotent). Bila (userId, kind, refId) sudah ada,
   * kembalikan baris lama tanpa duplikat (unique constraint sebagai
   * pengaman kedua).
   */
  async award(
    userId: string,
    kind: BadgeKind,
    refId: string | null,
  ): Promise<BadgeItem> {
    const where =
      refId == null
        ? { userId, kind, refId: IsNull() }
        : { userId, kind, refId };
    const existing = await this.badges.findOne({ where });
    if (existing) return this.toPublic(existing);
    try {
      return this.toPublic(
        await this.badges.save(
          this.badges.create({ userId, kind, refId: refId ?? null }),
        ),
      );
    } catch {
      // Balapan tulis bersamaan → baca ulang pemenangnya (unique guard).
      const raced = await this.badges.findOne({ where });
      if (raced) return this.toPublic(raced);
      throw new Error('Failed to award badge');
    }
  }

  /** GET /users/:id/badges — badge milik user mana pun. Tak ada user → 404. */
  async listByUser(userId: string): Promise<{ data: BadgeItem[] }> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const rows = await this.badges.find({
      where: { userId },
      order: { awardedAt: 'DESC' },
    });
    return { data: rows.map((b) => this.toPublic(b)) };
  }

  /** GET /badges/me — badge milik sendiri. */
  async listMine(userId: string): Promise<{ data: BadgeItem[] }> {
    const rows = await this.badges.find({
      where: { userId },
      order: { awardedAt: 'DESC' },
    });
    return { data: rows.map((b) => this.toPublic(b)) };
  }

  private toPublic(b: Badge): BadgeItem {
    return {
      id: b.id,
      userId: b.userId,
      kind: b.kind,
      refId: b.refId ?? null,
      awardedAt: b.awardedAt,
    };
  }
}
