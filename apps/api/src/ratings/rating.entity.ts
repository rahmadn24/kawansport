import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Venue } from '../venues/venue.entity';
import { Court } from '../venues/court.entity';
import { Review } from './review.entity';

/**
 * Rating untuk venue atau court tertentu.
 * Unique constraint: userId + venueId + courtId (courtId nullable = rating venue-level).
 * Score: integer 1-5.
 */
@Entity('ratings')
@Index(['userId', 'venueId', 'courtId'], { unique: true })
export class Rating {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ name: 'venue_id' })
  venueId!: string;

  @ManyToOne(() => Venue, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'venue_id' })
  venue?: Venue;

  @Column({ name: 'court_id', nullable: true })
  courtId?: string | null;

  @ManyToOne(() => Court, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'court_id' })
  court?: Court | null;

  /** Skor rating 1-5. */
  @Column({ type: 'int' })
  score!: number;

  @OneToOne(() => Review, (review) => review.rating, {
    cascade: true,
    nullable: true,
  })
  review?: Review | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}