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
import { SportEvent } from './event.entity';

/**
 * Status pembayaran join event berbayar (ST-02).
 * `pending` → `paid` (webhook settlement/capture-accept) atau
 * `expired`/`cancelled` (webhook expire/cancel/deny/failure).
 */
export type EventPaymentStatus =
  | 'pending'
  | 'paid'
  | 'expired'
  | 'cancelled';

export const EVENT_PAYMENT_STATUSES: EventPaymentStatus[] = [
  'pending',
  'paid',
  'expired',
  'cancelled',
];

/** true saat berjalan di atas sql.js in-memory (hanya untuk e2e test). */
const isSqljs = process.env.DB_DRIVER === 'sqljs';

/**
 * Order pembayaran join event berbayar (ST-02) — entitas ringan khusus event.
 *
 * KEPUTUSAN DESAIN (vs reuse ShopOrder/Booking): ShopOrder terikat
 * cart multiseller + grup seller + rollback stok, Booking terikat
 * court/slot_claims + expiry slot — keduanya membawa invarian yang tidak
 * relevan untuk "bayar iuran join event". Entitas ringan ini hanya menyimpan
 * snapshot nominal + status + referensi Midtrans, sehingga webhook existing
 * (`POST /payments/midtrans/notification`) bisa dipakai ulang via routing
 * prefix `order_id` `EV-` (pola yang sama dengan cabang `MP-` milik
 * marketplace) + guard idempotency `status !== 'pending'` + verifikasi
 * signature + `assertAmountMatches` yang sama persis.
 *
 * User tercatat sebagai participant HANYA setelah status `paid`
 * (pending TIDAK makan slot — lihat `EventsService.join`).
 */
@Entity('event_payments')
@Unique('uq_event_payments_payment_ref', ['paymentRef'])
export class EventPayment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'event_id' })
  eventId!: string;

  @ManyToOne(() => SportEvent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event?: SportEvent;

  @Column({ name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  /**
   * Snapshot `SportEvent.fee` (rupiah, IDR only) saat join diminta.
   * Webhook wajib mengirim `gross_amount` = nilai ini (409 bila beda).
   */
  @Column({ type: 'int' })
  amount!: number;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: EventPaymentStatus;

  /**
   * Referensi pembayaran = Midtrans `order_id` (prefix `EV-`).
   * Unique → kunci idempotensi webhook (double-hit aman via status guard).
   *
   * CATATAN: satu user bisa punya >1 baris payment per event sepanjang masa
   * (mis. pending kedaluwarsa lalu join ulang). "Satu pending aktif" ditegakkan
   * di `EventsService.join` (pakai ulang baris `pending` yang masih berlaku,
   * pola yang sama dengan Booking yang juga tanpa unique pair user+event).
   * Baris terminal (paid/expired/cancelled) dibiarkan sebagai jejak audit.
   */
  @Column({ name: 'payment_ref', type: 'varchar', length: 64, unique: true })
  paymentRef!: string;

  /** Token Snap Midtrans (atau stub bila tanpa server key). */
  @Column({ name: 'snap_token', type: 'varchar', length: 255, nullable: true })
  snapToken?: string | null;

  /** URL bayar Snap (atau stub bila tanpa server key). */
  @Column({ name: 'redirect_url', type: 'text', nullable: true })
  redirectUrl?: string | null;

  @Column(
    isSqljs
      ? { name: 'paid_at', type: 'datetime', nullable: true }
      : { name: 'paid_at', type: 'timestamptz', nullable: true },
  )
  paidAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
