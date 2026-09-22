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

export type DevicePlatform = 'ios' | 'android';

/** Token push FCM (registration token) per device (PH3-03 Expo → PH3-08 FCM; skema tabel tetap). Satu user bisa banyak device; kolom token unik global. */
@Entity('device_tokens')
@Index('uq_device_tokens_token', ['token'], { unique: true })
@Index('idx_device_tokens_user', ['userId'])
export class DeviceToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'varchar' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ type: 'varchar', length: 512 })
  token!: string;

  @Column({ type: 'varchar', length: 16 })
  platform!: DevicePlatform;

  @Column({ name: 'device_id', type: 'varchar', length: 128, nullable: true })
  deviceId?: string | null;

  @Column({ name: 'app_version', type: 'varchar', length: 32, nullable: true })
  appVersion?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
