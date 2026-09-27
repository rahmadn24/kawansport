import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../users/user.entity';

/** Jenis badge digital (EL-04). V1 hanya `tournament_champion`. */
export type BadgeKind = 'tournament_champion';

export const BADGE_KINDS: BadgeKind[] = ['tournament_champion'];

/**
 * Badge digital (EL-04). Diberikan otomatis bersama penentuan juara
 * turnamen (standing peringkat 1 saat semua fixture `confirmed`).
 * Duplikat dijaga via unique (user_id, kind, ref_id) + guard di service.
 */
@Entity('badges')
@Unique('uq_badges_user_kind_ref', ['userId', 'kind', 'refId'])
export class Badge {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ type: 'varchar', length: 40 })
  kind!: BadgeKind;

  /**
   * Referensi sumber badge — untuk `tournament_champion` = id turnamen.
   * Turnamen dihapus → SET NULL? TIDAK — CASCADE via user saja; refId
   * dibiarkan sebagai jejak (tanpa FK keras agar riwayat utuh).
   */
  @Column({ name: 'ref_id', type: 'varchar', nullable: true })
  refId?: string | null;

  @CreateDateColumn({ name: 'awarded_at' })
  awardedAt!: Date;
}
