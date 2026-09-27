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

/** Status turnamen mini (EL-03). */
export type TournamentStatus = 'draft' | 'ongoing' | 'done' | 'cancelled';

export const TOURNAMENT_STATUSES: TournamentStatus[] = [
  'draft',
  'ongoing',
  'done',
  'cancelled',
];

/**
 * true saat berjalan di atas sql.js in-memory (hanya untuk e2e test tanpa Postgres).
 * Dievaluasi saat modul dimuat — sama seperti branching driver di app.module.ts.
 */
const isSqljs = process.env.DB_DRIVER === 'sqljs';

/**
 * Turnamen mini 1v1 (EL-03). Fixture round-robin disimpan sebagai
 * `MatchResult` (EL-00) dengan `tournamentId` terisi; standing/juara/badge
 * SENGAJA tidak ada di sini (TODO EL-04).
 *
 * KEPUTUSAN: creator TIDAK otomatis menjadi peserta — `participantIds`
 * diisi eksplisit oleh client (boleh memasukkan id creator sendiri).
 */
@Entity('tournaments')
export class Tournament {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Nama turnamen (maks 120 char, ditegakkan di DTO). */
  @Column({ type: 'varchar', length: 120 })
  name!: string;

  /** Cabor, mis. `badminton` (maks 60 char, ditegakkan di DTO). */
  @Column({ type: 'varchar', length: 60 })
  sport!: string;

  /** Venue turnamen (opsional, diwariskan ke fixture). Venue dihapus → SET NULL. */
  @Column({ name: 'venue_id', type: 'varchar', nullable: true })
  venueId?: string | null;

  @ManyToOne(() => Venue, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'venue_id' })
  venue?: Venue | null;

  /** User pembuat turnamen (FK ke users, CASCADE). */
  @Column({ name: 'created_by' })
  createdBy!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by' })
  creator?: User;

  /**
   * Id user peserta. Postgres: text[] — sqljs-test: simple-json (portabel).
   * Min 3, maks 16, unik (di DTO + service).
   */
  @Column(
    isSqljs
      ? { type: 'simple-json', nullable: true }
      : { type: 'text', array: true, default: [] as string[] },
  )
  participantIds!: string[];

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status!: TournamentStatus;

  /**
   * Pemenang turnamen. Selalu null di EL-03 (diisi EL-04 via standing).
   * Nullable agar kolom siap tanpa migrasi susulan.
   */
  @Column({ name: 'winner_id', type: 'varchar', nullable: true })
  winnerId?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'winner_id' })
  winner?: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
