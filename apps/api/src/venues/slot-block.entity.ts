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
import { Court } from './court.entity';

/**
 * Blokir slot oleh owner (API-W06, mis. maintenance).
 * Satu baris = satu rentang [startMinute, endMinute) pada court+date.
 * Availability menandai slot yang overlap sebagai `blocked` (bukan `booked`
 * agar statistik okupansi jujur); hold/booking/walk-in yang overlap → 409.
 * Blok tidak kedaluwarsa (expire logic booking mengabaikannya) — dibuka
 * manual via DELETE.
 */
@Entity('slot_blocks')
@Unique('uq_slot_block_court_date_start', ['courtId', 'date', 'startMinute'])
export class SlotBlock {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'court_id' })
  courtId!: string;

  @ManyToOne(() => Court, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'court_id' })
  court?: Court;

  /** Tanggal blokir `YYYY-MM-DD` (zona tanggal venue, disimpan apa adanya). */
  @Column({ type: 'varchar', length: 10 })
  date!: string;

  /** Menit sejak 00:00, mis. 08:00 = 480. */
  @Column({ name: 'start_minute', type: 'int' })
  startMinute!: number;

  @Column({ name: 'end_minute', type: 'int' })
  endMinute!: number;

  /** Alasan blokir (mis. "maintenance AC"), opsional. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  reason?: string | null;

  /** Id user owner yang membuat blokir (jejak audit). */
  @Column({ name: 'created_by', type: 'varchar', nullable: true })
  createdBy?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
