import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

/** Jenis target yang dilaporkan (API-W02 + EL-05: `match` = MatchResult). */
export type DisputeTargetType =
  | 'booking'
  | 'order'
  | 'user'
  | 'venue'
  | 'match';

export const DISPUTE_TARGET_TYPES: DisputeTargetType[] = [
  'booking',
  'order',
  'user',
  'venue',
  'match',
];

/** Kategori laporan (API-W02). */
export type DisputeCategory = 'no_show' | 'smurfing' | 'refund' | 'other';

export const DISPUTE_CATEGORIES: DisputeCategory[] = [
  'no_show',
  'smurfing',
  'refund',
  'other',
];

/** Status penanganan dispute (API-W02). Default `open`. */
export type DisputeStatus =
  | 'open'
  | 'investigating'
  | 'resolved'
  | 'rejected';

export const DISPUTE_STATUSES: DisputeStatus[] = [
  'open',
  'investigating',
  'resolved',
  'rejected',
];

/**
 * Laporan/sengketa user (API-W02, dispute center).
 * `targetId` divalidasi longgar (non-empty) — tidak ada FK keras karena
 * target lintas tabel (booking/order/user/venue). EL-05: `targetType`
 * `match` merujuk id `MatchResult` (divalidasi di service: harus UUID
 * match yang ada; pelapor harus pemain match tsb atau super_admin;
 * match pending/confirmed otomatis menjadi `disputed`).
 */
@Entity('disputes')
export class Dispute {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'reporter_id' })
  reporterId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporter_id' })
  reporter?: User;

  @Column({ name: 'target_type', type: 'varchar', length: 20 })
  targetType!: DisputeTargetType;

  @Column({ name: 'target_id', type: 'varchar', length: 120 })
  targetId!: string;

  @Column({ type: 'varchar', length: 20 })
  category!: DisputeCategory;

  /** Deskripsi laporan (maks 2000 char, ditegakkan di DTO). */
  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'varchar', length: 20, default: 'open' })
  status!: DisputeStatus;

  /** Hasil/tindak lanjut admin (wajib bila resolve `resolved`). */
  @Column({ type: 'text', nullable: true })
  resolution?: string | null;

  /** Id super_admin yang me-resolve (audit). */
  @Column({ name: 'resolved_by', type: 'varchar', nullable: true })
  resolvedBy?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
