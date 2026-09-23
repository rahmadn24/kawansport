import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Penerima payout (API-W08): venue (saldo dari booking paid) atau seller (dari order groups paid). */
export type PayoutPayeeType = 'venue' | 'seller';

export const PAYOUT_PAYEE_TYPES: PayoutPayeeType[] = ['venue', 'seller'];

/**
 * Status payout (API-W08, payout manual TANPA integrasi disbursement —
 * keputusan PO: catat-dan-approve transfer manual).
 * Alur: requested → approved | rejected; approved → paid (+reference wajib).
 */
export type PayoutStatus = 'requested' | 'approved' | 'rejected' | 'paid';

export const PAYOUT_STATUSES: PayoutStatus[] = [
  'requested',
  'approved',
  'rejected',
  'paid',
];

/** Status yang mengunci saldo (mengurangi available): sudah disetujui / sudah ditransfer. */
export const PAYOUT_RESERVED_STATUSES: PayoutStatus[] = ['approved', 'paid'];

/**
 * Permintaan withdraw mitra (API-W08).
 * Saldo TIDAK disimpan di tabel terpisah (anti-drift) — selalu dihitung live
 * dari booking paid (net venue) + order groups paid (net seller) dikurangi
 * payout `approved`+`paid` (lihat `PayoutsService`).
 */
@Entity('payouts')
export class Payout {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'payee_type', type: 'varchar', length: 10 })
  payeeType!: PayoutPayeeType;

  /** Id venue (bila payeeType=venue) atau seller (bila payeeType=seller). */
  @Column({ name: 'payee_id', type: 'varchar', length: 36 })
  payeeId!: string;

  /** Nominal withdraw rupiah (integer > 0, ditegakkan di DTO). */
  @Column({ type: 'int' })
  amount!: number;

  @Column({ name: 'bank_name', type: 'varchar', length: 120, nullable: true })
  bankName?: string | null;

  @Column({
    name: 'account_number',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  accountNumber?: string | null;

  @Column({ name: 'account_name', type: 'varchar', length: 120, nullable: true })
  accountName?: string | null;

  @Column({ type: 'varchar', length: 20, default: 'requested' })
  status!: PayoutStatus;

  /**
   * Bukti transfer manual (teks bebas, mis. nomor referensi bank).
   * Opsional saat approve, WAJIB saat tandai paid.
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  reference?: string | null;

  /** Alasan penolakan admin (opsional, hanya saat reject). */
  @Column({ type: 'text', nullable: true })
  reason?: string | null;

  /** Id user yang meminta withdraw (mitra / super_admin yang mengajukan). */
  @Column({ name: 'requested_by', type: 'varchar', length: 36 })
  requestedBy!: string;

  /** Id super_admin terakhir yang menangani (approve/reject/pay). */
  @Column({ name: 'handled_by', type: 'varchar', length: 36, nullable: true })
  handledBy?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
