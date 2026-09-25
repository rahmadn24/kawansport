import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Rating } from './rating.entity';

/**
 * Review opsional yang terikat ke Rating (1:1).
 * Comment maksimal 1000 karakter.
 */
const isSqljs = process.env.DB_DRIVER === 'sqljs';

/** Kunci aspek penilaian review (ST-06). */
export type ReviewAspectKey = 'lapangan' | 'cahaya' | 'bersih' | 'staf';

export type ReviewAspects = Partial<Record<ReviewAspectKey, number>>;

@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'rating_id', unique: true })
  ratingId!: string;

  @OneToOne(() => Rating, (rating) => rating.review, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rating_id' })
  rating!: Rating;

  /** Komentar review, maksimal 1000 karakter. */
  @Column({ type: 'text', nullable: true })
  comment?: string | null;

  /**
   * URL/path foto review (ST-01, maks 3 — ditegakkan di DTO/service).
   * Postgres: text[] — sqljs-test: simple-array (portabel).
   */
  @Column(
    isSqljs
      ? { type: 'simple-array', nullable: true }
      : { type: 'text', array: true, default: [] as string[] },
  )
  photos?: string[] | null;

  /**
   * Penilaian aspek per fasilitas (ST-06): { lapangan?, cahaya?, bersih?, staf? },
   * masing-masing 1..5, semua opsional (parsial OK).
   * Postgres: jsonb — sqljs-test: simple-json (portabel).
   */
  @Column(
    isSqljs
      ? { type: 'simple-json', nullable: true }
      : { type: 'jsonb', nullable: true },
  )
  aspects?: ReviewAspects | null;

  /**
   * Tag sorotan review (ST-06): maks 5 x 30 char, dinormalisasi
   * lowercase-trim + dedupe di service.
   * Postgres: text[] — sqljs-test: simple-array (portabel).
   */
  @Column(
    isSqljs
      ? { type: 'simple-array', nullable: true }
      : { type: 'text', array: true, default: [] as string[] },
  )
  tags?: string[] | null;

  /**
   * Mode anonim (ST-06): bila true, respons publik menyamarkan user
   * jadi "Anonim" + avatar null; owner review + admin tetap lihat asli.
   */
  @Column({ name: 'is_anonymous', type: 'boolean', default: false })
  isAnonymous!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}