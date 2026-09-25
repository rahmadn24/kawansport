import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

/** Status moderasi seller (MP-01). Alur: pending -> approved | rejected. */
export type SellerStatus = 'pending' | 'approved' | 'rejected';

export const SELLER_STATUSES: SellerStatus[] = [
  'pending',
  'approved',
  'rejected',
];

@Entity('sellers')
@Unique('uq_sellers_owner_id', ['ownerId'])
export class Seller {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'owner_id' })
  ownerId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner?: User;

  @Column({ name: 'shop_name', type: 'varchar', length: 120 })
  shopName!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  /**
   * Status moderasi. Postgres: varchar + transisi dijaga service.
   * User apply -> `pending` (role tetap `user`); admin approve ->
   * `approved` (+ `users.role` jadi `seller`); reject -> `rejected`.
   */
  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: SellerStatus;

  /** Alasan penolakan admin (diisi saat reject, dibersihkan saat approve). */
  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason?: string | null;

  /**
   * Toko terverifikasi (ST-05). Default false; hanya super_admin via
   * POST /sellers/:id/verify. Tampil di payload produk (`seller.verified`).
   */
  @Column({ type: 'boolean', default: false })
  verified!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
