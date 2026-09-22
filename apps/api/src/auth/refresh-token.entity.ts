import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'user_id' })
  userId!: string;

  /** SHA-256 hex dari refresh JWT mentah. Tidak pernah simpan token mentah. */
  @Column({ name: 'token_hash', unique: true })
  tokenHash!: string;

  // Tanpa type eksplisit agar portabel: timestamp (postgres) / datetime (sqljs-test).
  @Column({ name: 'expires_at' })
  expiresAt!: Date;

  @Column({ default: false })
  revoked!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
