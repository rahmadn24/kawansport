import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Seller } from './seller.entity';

/** Status order marketplace (MP-02) — selaras status booking BK-03. */
export type ShopOrderStatus = 'pending' | 'paid' | 'expired' | 'cancelled';

export const SHOP_ORDER_STATUSES: ShopOrderStatus[] = [
  'pending',
  'paid',
  'expired',
  'cancelled',
];

/** true saat berjalan di atas sql.js in-memory (hanya untuk e2e test). */
const isSqljs = process.env.DB_DRIVER === 'sqljs';

/**
 * Satu order hasil checkout multiseller: 1 order + N grup (satu per seller).
 * `paymentRef` unique = Midtrans `order_id` dengan prefix "MP-" (bedakan dari
 * "BK-" milik booking; webhook routing via prefix). `channel` disimpan
 * eksplisit untuk queryabilitas ("marketplace").
 */
@Entity('orders')
@Unique('uq_orders_payment_ref', ['paymentRef'])
export class ShopOrder {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ name: 'payment_ref', type: 'varchar', length: 64, unique: true })
  paymentRef!: string;

  /** Kanal asal order — selalu 'marketplace' untuk MP-02. */
  @Column({ type: 'varchar', length: 20, default: 'marketplace' })
  channel!: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: ShopOrderStatus;

  /** Total rupiah (snapshot harga saat checkout). */
  @Column({ type: 'int' })
  total!: number;

  @Column({ name: 'snap_token', type: 'varchar', length: 255, nullable: true })
  snapToken?: string | null;

  @Column({ name: 'redirect_url', type: 'text', nullable: true })
  redirectUrl?: string | null;

  @Column(
    isSqljs
      ? { name: 'paid_at', type: 'datetime', nullable: true }
      : { name: 'paid_at', type: 'timestamptz', nullable: true },
  )
  paidAt?: Date | null;

  @OneToMany(() => ShopOrderGroup, (group) => group.order, { cascade: false })
  groups?: ShopOrderGroup[];

  @OneToMany(() => ShopOrderItem, (item) => item.order, { cascade: false })
  items?: ShopOrderItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

/**
 * Pecahan order per seller: subtotal + status yang mengikuti status order
 * induk (paid/expired/cancelled disinkronkan webhook).
 */
@Entity('order_groups')
@Unique('uq_order_groups_order_seller', ['orderId', 'sellerId'])
export class ShopOrderGroup {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'order_id' })
  orderId!: string;

  @ManyToOne(() => ShopOrder, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order?: ShopOrder;

  @Column({ name: 'seller_id' })
  sellerId!: string;

  @ManyToOne(() => Seller, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'seller_id' })
  seller?: Seller;

  @Column({ type: 'int' })
  subtotal!: number;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: ShopOrderStatus;

  @OneToMany(() => ShopOrderItem, (item) => item.group, { cascade: false })
  items?: ShopOrderItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

/**
 * Baris item order (snapshot harga + nama saat checkout). Produk hanya
 * disimpan sebagai `productId` + snapshot (tanpa FK keras) agar riwayat order
 * tetap utuh walau produk berubah/dihapus.
 */
@Entity('order_items')
export class ShopOrderItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'order_id' })
  orderId!: string;

  @ManyToOne(() => ShopOrder, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order?: ShopOrder;

  @Column({ name: 'group_id' })
  groupId!: string;

  @ManyToOne(() => ShopOrderGroup, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group?: ShopOrderGroup;

  @Column({ name: 'product_id', type: 'varchar', length: 36 })
  productId!: string;

  @Column({ name: 'seller_id', type: 'varchar', length: 36 })
  sellerId!: string;

  /** Snapshot nama produk (untuk tampilan riwayat). */
  @Column({ name: 'product_name', type: 'varchar', length: 120 })
  productName!: string;

  @Column({ type: 'int' })
  qty!: number;

  /** Snapshot harga satuan saat checkout. */
  @Column({ type: 'int' })
  price!: number;

  @Column({ type: 'int' })
  subtotal!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
