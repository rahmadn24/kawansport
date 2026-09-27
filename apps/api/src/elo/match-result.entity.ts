import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Venue } from '../venues/venue.entity';

/** Status hasil match (EL-00). */
export type MatchStatus = 'pending' | 'confirmed' | 'disputed' | 'cancelled';

export const MATCH_STATUSES: MatchStatus[] = [
  'pending',
  'confirmed',
  'disputed',
  'cancelled',
];

/**
 * true saat berjalan di atas sql.js in-memory (hanya untuk e2e test tanpa Postgres).
 * Dievaluasi saat modul dimuat — sama seperti branching driver di app.module.ts.
 */
const isSqljs = process.env.DB_DRIVER === 'sqljs';

/**
 * Hasil match antar tim (EL-00). ELO baru diterapkan saat status menjadi
 * `confirmed` (konfirmasi dua pihak — satu confirmer dari tiap tim).
 */
@Entity('match_results')
export class MatchResult {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Cabor, mis. `badminton` (maks 60 char, ditegakkan di DTO). */
  @Column({ type: 'varchar', length: 60 })
  sport!: string;

  /** Venue tempat main (opsional). Venue dihapus → SET NULL (riwayat utuh). */
  @Column({ name: 'venue_id', type: 'varchar', nullable: true })
  venueId?: string | null;

  @ManyToOne(() => Venue, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'venue_id' })
  venue?: Venue | null;

  /**
   * Id user tim A. Postgres: text[] — sqljs-test: simple-json (portabel).
   * Validasi tiap UUID + tak boleh overlap dengan teamB + min 1v1 (di service).
   */
  @Column(
    isSqljs
      ? { type: 'simple-json', nullable: true }
      : { type: 'text', array: true, default: [] as string[] },
  )
  teamA!: string[];

  /** Id user tim B (aturan sama dengan teamA). */
  @Column(
    isSqljs
      ? { type: 'simple-json', nullable: true }
      : { type: 'text', array: true, default: [] as string[] },
  )
  teamB!: string[];

  /** Skor tim A (>= 0). */
  @Column({ name: 'score_a', type: 'int' })
  scoreA!: number;

  /** Skor tim B (>= 0). */
  @Column({ name: 'score_b', type: 'int' })
  scoreB!: number;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: MatchStatus;

  /** User pencatat hasil (FK ke users, CASCADE). */
  @Column({ name: 'created_by' })
  createdBy!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by' })
  creator?: User;

  /**
   * Id user yang sudah konfirmasi. Postgres: text[] — sqljs-test: simple-json.
   * Creator otomatis confirmer pihak timnya bila ia termasuk salah satu tim.
   * Match confirmed bila ada >= 1 confirmer dari teamA DAN >= 1 dari teamB.
   */
  @Column(
    isSqljs
      ? { type: 'simple-json', nullable: true }
      : { type: 'text', array: true, default: [] as string[] },
  )
  confirmedBy!: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
