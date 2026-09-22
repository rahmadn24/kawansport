import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../users/user.entity';
import { SportEvent } from './event.entity';

/**
 * Peserta event (SM-05). Satu baris = satu user ikut satu event.
 * Pasangan (event_id, user_id) unik — double-join ditolak di level DB
 * sebagai jaring pengaman terakhir selain cek transaksional di service.
 */
@Entity('event_participants')
@Unique('uq_event_participants_event_user', ['eventId', 'userId'])
export class EventParticipant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'event_id' })
  eventId!: string;

  @ManyToOne(() => SportEvent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event?: SportEvent;

  @Column({ name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt!: Date;
}
