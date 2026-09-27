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

  @Column({ name: 'match_id' })
  matchId!: string;

  @ManyToOne(() => MatchResult, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'match_id' })
  match?: MatchResult;

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
