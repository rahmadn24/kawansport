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

/** Status klaim slot (BK-02). `confirmed` diisi modul booking BK-03 nanti. */
export type SlotClaimStatus = 'held' | 'confirmed' | 'released';

export const SLOT_CLAIM_STATUSES: SlotClaimStatus[] = [
  'held',
  'confirmed',
  'released',
];

/** true saat berjalan di atas sql.js in-memory (hanya untuk e2e test). */
const isSqljs = process.env.DB_DRIVER === 'sqljs';

@Entity('slot_claims')
@Unique('uq_slot_claim_court_date_start', ['courtId', 'date', 'startMinute'])
export class SlotClaim {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'court_id' })
  courtId!: string;

  @ManyToOne(() => Court, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'court_id' })
  court?: Court;

  /** Tanggal slot `YYYY-MM-DD` (zona tanggal venue, disimpan apa adanya). */
  @Column({ type: 'varchar', length: 10 })
  date!: string;

  /** Menit sejak 00:00, mis. 08:00 = 480. */
  @Column({ name: 'start_minute', type: 'int' })
  startMinute!: number;

  @Column({ name: 'end_minute', type: 'int' })
  endMinute!: number;

  @Column({ type: 'varchar', length: 20, default: 'held' })
  status!: SlotClaimStatus;

  /** User pemegang hold (dari JWT). */
  @Column({ name: 'holder_id', type: 'varchar', length: 36 })
  holderId!: string;

  /** Hold kedaluwarsa 10 menit setelah dibuat; confirmed/released abaikan. */
  @Column(
    isSqljs
      ? { name: 'expires_at', type: 'datetime', nullable: true }
      : { name: 'expires_at', type: 'timestamptz', nullable: true },
  )
  expiresAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
