import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { MatchResult } from './match-result.entity';

/**
 * Jejak audit perubahan ELO per pemain per match confirmed (EL-00).
 * Ditulis sekali per pemain saat match menjadi `confirmed`.
 * EL-05: baris decay (`kind: 'decay'`) ditulis saat decay oportunistik
 * diterapkan — tanpa match (`matchId` null, `kFactor` 0).
 */
@Entity('elo_history')
export class EloHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ type: 'varchar', length: 60 })
  sport!: string;

  /**
   * Sumber perubahan: `match` (default, EL-00) atau `decay` (EL-05).
   * Baris lama (pra-EL-05) terisi `match` via default kolom.
   */
  @Column({ type: 'varchar', length: 20, default: 'match' })
  kind!: string;

  /** Null untuk baris decay (tidak terkait match mana pun). */
  @Column({ name: 'match_id', type: 'varchar', nullable: true })
  matchId?: string | null;

  @ManyToOne(() => MatchResult, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'match_id' })
  match?: MatchResult | null;

  /** Skor sebelum match. */
  @Column({ type: 'int' })
  before!: number;

  /** Skor sesudah match (= before + delta). */
  @Column({ type: 'int' })
  after!: number;

  /** Selisih (bisa negatif bagi pecundang). */
  @Column({ type: 'int' })
  delta!: number;

  /** K-factor yang dipakai untuk pemain ini saat itu. */
  @Column({ name: 'k_factor', type: 'int' })
  kFactor!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
