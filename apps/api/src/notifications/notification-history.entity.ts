import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

const isSqljs = process.env.DB_DRIVER === 'sqljs';

/** Riwayat notifikasi per-user (GAP-01). Ditulis setiap sendToUsers, tanpa mengubah kontrak send. */
@Entity('notification_history')
@Index('idx_notification_history_user', ['userId'])
export class NotificationHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ type: 'varchar', length: 20, default: 'system' })
  type!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'varchar', length: 1000 })
  body!: string;

  @Column({ type: 'simple-json', nullable: true })
  data?: Record<string, unknown> | null;

  @Column(
    isSqljs
      ? { name: 'read_at', type: 'datetime', nullable: true }
      : { name: 'read_at', type: 'timestamptz', nullable: true },
  )
  readAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
