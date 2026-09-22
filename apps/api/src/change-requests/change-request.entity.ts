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

/** Tipe entity yang bisa dimintakan perubahannya (AD-02). */
export type ChangeRequestEntityType = 'venue' | 'court' | 'product';

export const CHANGE_REQUEST_ENTITY_TYPES: ChangeRequestEntityType[] = [
  'venue',
  'court',
  'product',
];

/** Status moderasi change request (AD-02). Alur: pending -> approved | rejected. */
export type ChangeRequestStatus = 'pending' | 'approved' | 'rejected';

export const CHANGE_REQUEST_STATUSES: ChangeRequestStatus[] = [
  'pending',
  'approved',
  'rejected',
];

/**
 * Permintaan perubahan field sensitif atas entity yang sudah `approved`.
 * Edit owner/seller atas entity approved TIDAK langsung mengubah entity —
 * melainkan tercatat di sini sebagai `pending` (publik tetap membaca data
 * lama) sampai admin approve (payload diterapkan) / reject (+reason).
 * Baris ini + kolom `updated_by` di entity = jejak audit.
 */
@Entity('change_requests')
export class ChangeRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'entity_type', type: 'varchar', length: 20 })
  entityType!: ChangeRequestEntityType;

  /** Id venue / court / product yang dimintakan perubahannya. */
  @Column({ name: 'entity_id' })
  entityId!: string;

  /** Patch ternormalisasi, mis. `{ "price": 800000 }` / `{ "name": "..." }`. */
  @Column({ type: 'simple-json' })
  payload!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: ChangeRequestStatus;

  /** User yang mengajukan (owner venue / seller). */
  @Column({ name: 'requested_by' })
  requestedBy!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requested_by' })
  requester?: User;

  /** Admin yang mereview (diisi saat approve/reject). */
  @Column({ name: 'reviewed_by', nullable: true })
  reviewedBy?: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewed_by' })
  reviewer?: User;

  /** Alasan penolakan admin (diisi saat reject, null saat approve). */
  @Column({ type: 'text', nullable: true })
  reason?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
