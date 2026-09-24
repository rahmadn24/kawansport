import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

export type InviteStatus = 'pending' | 'accepted' | 'declined' | 'expired';

export const INVITE_STATUSES: InviteStatus[] = [
  'pending',
  'accepted',
  'declined',
  'expired',
];

/** Undangan sparing 1-1 (GAP-01). Accept oleh penerima membuat/get conversation. */
@Entity('invites')
@Index('idx_invites_to', ['toUserId'])
@Index('idx_invites_from', ['fromUserId'])
export class Invite {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'from_user_id', type: 'varchar', length: 36 })
  fromUserId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'from_user_id' })
  fromUser?: User;

  @Column({ name: 'to_user_id', type: 'varchar', length: 36 })
  toUserId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'to_user_id' })
  toUser?: User;

  @Column({ type: 'varchar', length: 60, nullable: true })
  sport?: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  message?: string | null;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: InviteStatus;

  /** Id event opsional (tanpa FK keras — event bisa dihapus). */
  @Column({ name: 'event_id', type: 'varchar', length: 36, nullable: true })
  eventId?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
