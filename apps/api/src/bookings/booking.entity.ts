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
import { Court } from '../venues/court.entity';
import { SportEvent } from '../events/event.entity';

/** Status booking (BK-03, keputusan PO: pending 30 mnt → expired). */
export type BookingStatus = 'pending' | 'paid' | 'expired' | 'cancelled';

/** Kanal asal booking (API-W06): `app` = via POST /bookings, `walkin` = owner input langsung. */
export type BookingChannel = 'app' | 'walkin';

export const BOOKING_CHANNELS: BookingChannel[] = ['app', 'walkin'];

export const BOOKING_STATUSES: BookingStatus[] = [
  'pending',
  'paid',
  'expired',
  'cancelled',
];

/** true saat berjalan di atas sql.js in-memory (hanya untuk e2e test). */
const isSqljs = process.env.DB_DRIVER === 'sqljs';

/**
 * Satu baris snapshot item sewa dalam booking (ST-10).
 * `price` = harga satuan saat booking; `subtotal` = price*qty.
 */
export interface RentalSnapshot {
  rentalId: string;
  name: string;
  price: number;
  qty: number;
  subtotal: number;
}

@Entity('bookings')
@Unique('uq_bookings_payment_ref', ['paymentRef'])
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ name: 'court_id' })
  courtId!: string;

  @ManyToOne(() => Court, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'court_id' })
  court?: Court;

  /** Tanggal main `YYYY-MM-DD` (zona tanggal venue, disimpan apa adanya). */
  @Column({ type: 'varchar', length: 10 })
  date!: string;

  /** Menit sejak 00:00, mis. 08:00 = 480. */
  @Column({ name: 'start_minute', type: 'int' })
  startMinute!: number;

  @Column({ name: 'end_minute', type: 'int' })
  endMinute!: number;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: BookingStatus;

  /**
   * Referensi pembayaran = Midtrans `order_id`. Unique → kunci idempotensi
   * webhook (double-hit aman via status guard + unique ini).
   */
  @Column({ name: 'payment_ref', type: 'varchar', length: 64, unique: true })
  paymentRef!: string;

  /** Snapshot harga saat booking dibuat (rupiah, prorata durasi). */
  @Column({ type: 'int' })
  amount!: number;

  /**
   * Subtotal sebelum voucher/poin (ST-04). Sama dengan `amount` bila tanpa
   * diskon/poin; nullable agar baris lama (pra-ST-04) tetap valid — response
   * memakai fallback `amount` bila null.
   */
  @Column({ type: 'int', nullable: true })
  subtotal?: number | null;

  /** Diskon voucher rupiah (ST-04, snapshot, default 0). */
  @Column({ type: 'int', default: 0 })
  discount!: number;

  /** Kode voucher terpakai (ST-04, snapshot uppercase, null bila tanpa voucher). */
  @Column({ name: 'voucher_code', type: 'varchar', length: 32, nullable: true })
  voucherCode?: string | null;

  /** Poin Kawan terpakai, 1 poin = Rp1 (ST-04, snapshot, default 0). */
  @Column({ name: 'points_used', type: 'int', default: 0 })
  pointsUsed!: number;

  /**
   * Service fee snapshot rupiah (API-W03). Diambil dari pengaturan platform
   * `service_fee_enabled` + `service_fee_amount` saat booking dibuat;
   * 0 bila fee dinonaktifkan. Poin/voucher TIDAK menutup fee (cap poin =
   * subtotal - diskon); `amount` = max(0, subtotal - discount - pointsUsed)
   * + serviceFee.
   */
  @Column({ name: 'service_fee', type: 'int', default: 0 })
  serviceFee!: number;

  /** Token Snap Midtrans (atau stub bila tanpa server key). */
  @Column({ name: 'snap_token', type: 'varchar', length: 255, nullable: true })
  snapToken?: string | null;

  /** URL bayar Snap (atau stub bila tanpa server key). */
  @Column({ name: 'redirect_url', type: 'text', nullable: true })
  redirectUrl?: string | null;

  /** Klaim slot (`slot_claims.id`) yang di-confirmed untuk booking ini. */
  @Column({ name: 'slot_claim_id', type: 'varchar', length: 36, nullable: true })
  slotClaimId?: string | null;

  /**
   * Snapshot item sewa (ST-10): `[{ rentalId, name, price, qty, subtotal }]`.
   * Disalin saat booking dibuat agar riwayat utuh walau item rental diubah/
   * dihapus owner kemudian. simple-json portabel postgres maupun sqljs-test.
   */
  @Column({ name: 'rentals', type: 'simple-json', nullable: true })
  rentals?: RentalSnapshot[] | null;

  /**
   * Total sewa (`sum(price*qty)`, ST-10, snapshot rupiah). Sudah termasuk
   * dalam `subtotal` (dan karenanya `amount`); kolom sendiri agar CMS/
   * kasir bisa menampilkan rincian tanpa menjumlah ulang.
   */
  @Column({ name: 'rentals_total', type: 'int', default: 0 })
  rentalsTotal!: number;

  /**
   * Event asal booking ini (BK-04, nullable). Booking langsung via
   * POST /bookings → null; booking dari event via POST /events/:id/book
   * → id event. Cascade SET NULL? Event tidak dihapus (tidak ada endpoint
   * hapus), jadi CASCADE aman dan menjaga referensi tetap bersih.
   */
  @Column({ name: 'event_id', type: 'varchar', nullable: true })
  eventId?: string | null;

  @ManyToOne(() => SportEvent, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event?: SportEvent | null;

  @Column(
    isSqljs
      ? { name: 'paid_at', type: 'datetime', nullable: true }
      : { name: 'paid_at', type: 'timestamptz', nullable: true },
  )
  paidAt?: Date | null;

  /**
   * Kanal asal booking (API-W06). Default `app`; walk-in owner → `walkin`.
   * Postgres memakai varchar agar tambah nilai kanal baru tidak butuh migrasi enum.
   */
  @Column({ type: 'varchar', length: 10, default: 'app' })
  channel!: BookingChannel;

  /**
   * Nama pembeli walk-in (API-W06, wajib diisi saat create walk-in).
   * Booking `app` → null (identitas = relasi user).
   */
  @Column({ name: 'buyer_name', type: 'varchar', length: 120, nullable: true })
  buyerName?: string | null;

  /**
   * Id user yang mencatat booking (API-W06, jejak audit walk-in = owner).
   * Booking `app` → null (pencatat = user itu sendiri).
   */
  @Column({ name: 'created_by', type: 'varchar', nullable: true })
  createdBy?: string | null;

  /**
   * Kode human-readable untuk check-in (API-W07, format `KS-XXXXXX`).
   * Unique + dibuat saat create SEMUA channel; nullable agar baris lama
   * (pra-W07) tetap valid — di-backfill oportunistik oleh
   * `BookingsService.expireDueBookings` (dipanggil di hampir semua path baca/tulis).
   */
  @Column({ type: 'varchar', length: 16, unique: true, nullable: true })
  code?: string | null;

  /**
   * Waktu check-in (API-W07). Diisi sekali via POST /bookings/:id/check-in;
   * check-in ulang → 409.
   */
  @Column(
    isSqljs
      ? { name: 'checked_in_at', type: 'datetime', nullable: true }
      : { name: 'checked_in_at', type: 'timestamptz', nullable: true },
  )
  checkedInAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
