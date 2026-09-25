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

/** Status operasional court (BK-01). */
export type CourtStatus = 'active' | 'inactive';

export const COURT_STATUSES: CourtStatus[] = ['active', 'inactive'];

/** true saat berjalan di atas sql.js in-memory (hanya untuk e2e test). */
const isSqljs = process.env.DB_DRIVER === 'sqljs';

@Entity('courts')
export class Court {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'venue_id' })
  venueId!: string;

  @ManyToOne(() => Venue, (venue) => venue.courts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'venue_id' })
  venue?: Venue;

  @Column({ type: 'varchar', length: 60 })
  sport!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  /** Harga sewa per jam dalam rupiah. */
  @Column({ name: 'price_per_hour', type: 'int' })
  pricePerHour!: number;

  /**
   * Jam operasional, mis. `{ "mon": ["08:00-22:00"], ... }`.
   * simple-json portabel untuk postgres maupun sqljs-test.
   */
  @Column({ name: 'open_hours', type: 'simple-json', nullable: true })
  openHours?: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: CourtStatus;

  /**
   * Fasilitas spesifik court (ST-10, allowlist di `facilities.ts`,
   * AD-02 non-sensitif — PATCH langsung berlaku).
   * Postgres: text[] — sqljs-test: simple-array (portabel).
   */
  @Column(
    isSqljs
      ? { type: 'simple-array', nullable: true }
      : { type: 'text', array: true, default: [] as string[] },
  )
  facilities?: string[] | null;

  /**
   * Id user yang terakhir mengubah (AD-02, jejak audit).
   * Diisi editor langsung maupun admin saat approve change request.
   */
  @Column({ name: 'updated_by', type: 'varchar', nullable: true })
  updatedBy?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
