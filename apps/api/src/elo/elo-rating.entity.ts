import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../users/user.entity';

/**
 * true saat berjalan di atas sql.js in-memory (hanya untuk e2e test tanpa Postgres).
 * Pola sama seperti `match-result.entity.ts` (datetime vs timestamptz).
 */
const isSqljs = process.env.DB_DRIVER === 'sqljs';

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

  /**
   * Waktu match confirmed terakhir di cabor ini (EL-05, jangkar decay).
   * Diisi saat ELO diterapkan (confirm / resolve-dispute confirm /
   * walkover); null = belum pernah main (tidak kena decay).
   * Decay TIDAK PERNAH mengubah kolom ini (keputusan EL-05) — idempotensi
   * decay dijaga oleh `decayedPeriods`, bukan dengan menggeser jangkar.
   */
  @Column(
    isSqljs
      ? { name: 'last_match_at', type: 'datetime', nullable: true }
      : { name: 'last_match_at', type: 'timestamptz', nullable: true },
  )
  lastMatchAt?: Date | null;

  /**
   * Jumlah periode decay 30-hari yang SUDAH diterapkan ke skor ini
   * (EL-05). Direset ke 0 setiap kali ada match confirmed baru.
   * Tanpa kolom ini, decay oportunistik pada tiap baca akan mengurangi
   * skor BERULANG (double-decay) karena `lastMatchAt` tidak digeser.
   */
  @Column({ name: 'decayed_periods', type: 'int', default: 0 })
  decayedPeriods!: number;
}
