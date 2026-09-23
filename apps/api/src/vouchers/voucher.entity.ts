import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/** Jenis diskon voucher (ST-04). */
export type VoucherType = 'percent' | 'fixed';

export const VOUCHER_TYPES: VoucherType[] = ['percent', 'fixed'];

/** Sasaran pemakaian voucher: booking lapangan / belanja shop / keduanya. */
export type VoucherScope = 'booking' | 'shop' | 'all';

export const VOUCHER_SCOPES: VoucherScope[] = ['booking', 'shop', 'all'];

/** true saat berjalan di atas sql.js in-memory (hanya untuk e2e test). */
const isSqljs = process.env.DB_DRIVER === 'sqljs';

/**
 * Voucher promo (ST-04). `code` unik (selalu uppercase, dinormalisasi di
 * service). `quota` = batas total pemakaian (null = tanpa batas);
 * `perUserLimit` = batas pemakaian per user (null = tanpa batas).
 * `usedCount` = jumlah redeem berhasil (sumber kebenaran untuk kuota global;
 * redeem dianggap terpakai sejak booking/order dibuat — status terminal via
 * webhook TIDAK mengembalikan kuota). Nonaktif via `active=false`
 * (deactivate, tanpa hard delete).
 */
@Entity('vouchers')
@Unique('uq_vouchers_code', ['code'])
export class Voucher {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Kode promo, uppercase (mis. `HEMAT50`). */
  @Column({ type: 'varchar', length: 32, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 10, default: 'fixed' })
  type!: VoucherType;

  /**
   * Nilai diskon: persen 1..100 bila `type=percent`, rupiah (>=1) bila
   * `type=fixed`.
   */
  @Column({ type: 'int' })
  value!: number;

  /** Batas rupiah diskon untuk `type=percent` (null = tanpa batas). */
  @Column({ name: 'max_discount', type: 'int', nullable: true })
  maxDiscount?: number | null;

  /** Minimal subtotal transaksi agar voucher bisa dipakai (default 0). */
  @Column({ name: 'min_transaction', type: 'int', default: 0 })
  minTransaction!: number;

  /** Kuota total (null = tanpa batas). */
  @Column({ type: 'int', nullable: true })
  quota?: number | null;

  /** Batas pakai per user (null = tanpa batas). */
  @Column({ name: 'per_user_limit', type: 'int', nullable: true })
  perUserLimit?: number | null;

  /** Jumlah redeem berhasil (di-increment atomik dalam transaksi redeem). */
  @Column({ name: 'used_count', type: 'int', default: 0 })
  usedCount!: number;

  @Column(
    isSqljs
      ? { name: 'valid_from', type: 'datetime', nullable: true }
      : { name: 'valid_from', type: 'timestamptz', nullable: true },
  )
  validFrom?: Date | null;

  @Column(
    isSqljs
      ? { name: 'valid_to', type: 'datetime', nullable: true }
      : { name: 'valid_to', type: 'timestamptz', nullable: true },
  )
  validTo?: Date | null;

  @Column({ name: 'applicable_to', type: 'varchar', length: 10, default: 'all' })
  applicableTo!: VoucherScope;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

/**
 * Jejak redeem voucher per user (ST-04). Satu baris per booking/order yang
 * memakai voucher — dipakai untuk menegakkan `perUserLimit`. Baris dibuat
 * dalam transaksi yang sama dengan booking/order; dihapus hanya oleh
 * kompensasi Snap-gagal (pola yang sama dengan rollback stok MP-02).
 */
@Entity('voucher_redemptions')
export class VoucherRedemption {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'voucher_id' })
  voucherId!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  /** Booking hasil redeem (null bila redeem untuk order shop). */
  @Column({ name: 'booking_id', type: 'varchar', length: 36, nullable: true })
  bookingId?: string | null;

  /** Order shop hasil redeem (null bila redeem untuk booking). */
  @Column({ name: 'order_id', type: 'varchar', length: 36, nullable: true })
  orderId?: string | null;

  /** Snapshot diskon rupiah yang diberikan redeem ini. */
  @Column({ type: 'int', default: 0 })
  discount!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
