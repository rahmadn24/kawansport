import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../users/user.entity';

/** Rating ELO per user per cabor (EL-00). */
@Entity('elo_ratings')
@Unique('uq_elo_ratings_user_sport', ['userId', 'sport'])
export class EloRating {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  /** Cabor, mis. `badminton` (maks 60 char, ditegakkan di DTO). */
  @Column({ type: 'varchar', length: 60 })
  sport!: string;

  /** Skor ELO (default 1000 untuk pemain baru). */
  @Column({ type: 'int', default: 1000 })
  score!: number;

  /**
   * Jumlah match confirmed yang sudah dimainkan di cabor ini.
   * `provisional` = matchesPlayed < 10 — DERIVED (tanpa kolom sendiri).
   */
  @Column({ name: 'matches_played', type: 'int', default: 0 })
  matchesPlayed!: number;
}
