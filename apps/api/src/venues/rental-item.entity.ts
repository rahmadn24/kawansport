import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Venue } from './venue.entity';

/** Status operasional item rental (ST-10). */
export type RentalItemStatus = 'active' | 'inactive';

export const RENTAL_ITEM_STATUSES: RentalItemStatus[] = [
  'active',
  'inactive',
];

/**
 * Item sewa milik venue (ST-10, mis. bola, sepatu, raket, rompi).
 *
 * - Stok HANYA dicek saat booking (tanpa decrement — barang diambil di
 *   tempat; dokumentasi di ENDPOINTS.md). Tidak ada kolom reserved.
 * - `status` inactive = disembunyikan dari katalog publik + booking
 *   memakai item tsb ditolak 409.
 */
@Entity('rental_items')
export class RentalItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'venue_id' })
  venueId!: string;

  @ManyToOne(() => Venue, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'venue_id' })
  venue?: Venue;

  /** Nama item, mis. "Bola futsal". */
  @Column({ type: 'varchar', length: 120 })
  name!: string;

  /** Harga sewa per booking dalam rupiah. */
  @Column({ type: 'int' })
  price!: number;

  /** Stok tersedia (dicek saat booking, tidak di-decrement). */
  @Column({ type: 'int' })
  stock!: number;

  /** Satuan opsional, mis. "pcs", "pasang", "set". */
  @Column({ type: 'varchar', length: 30, nullable: true })
  unit?: string | null;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: RentalItemStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
