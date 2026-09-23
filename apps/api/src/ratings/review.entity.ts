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

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}