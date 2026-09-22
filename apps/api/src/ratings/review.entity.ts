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

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}