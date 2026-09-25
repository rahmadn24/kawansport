import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Seller } from './seller.entity';

/**
 * Status moderasi produk (MP-01). Alur: draft -> pending -> approved | rejected.
 */
export type ProductStatus = 'draft' | 'pending' | 'approved' | 'rejected';

export const PRODUCT_STATUSES: ProductStatus[] = [
  'draft',
  'pending',
  'approved',
  'rejected',
];

/**
 * Satu varian produk (ST-05): mis. `{ name: 'Ukuran 42', priceDelta: 20000,
 * stock: 5 }`. `priceDelta` = selisih rupiah terhadap harga dasar (boleh
 * negatif untuk varian lebih murah, default 0). `stock` opsional = stok
 * khusus varian ini; bila diisi, stok varian dipakai (bukan stok dasar)
 * saat cart/checkout — lihat ENDPOINTS.md seksi ST-05.
 */
export interface ProductVariant {
  name: string;
  priceDelta: number;
  stock?: number | null;
}

/**
 * Badge tampilan produk (ST-05, manual oleh seller via create/update).
 * `best_seller` SENGAJA manual (kurasi seller), BUKAN komputasi real-time
 * dari order_items — didokumentasikan di ENDPOINTS.md.
 */
export type ProductBadge = 'original' | 'best_seller' | 'baru';

export const PRODUCT_BADGES: ProductBadge[] = [
  'original',
  'best_seller',
  'baru',
];

/** Maksimal varian per produk (ST-05, keputusan minimal). */
export const MAX_PRODUCT_VARIANTS = 10;

/**
 * true saat berjalan di atas sql.js in-memory (hanya untuk e2e test tanpa Postgres).
 * Dievaluasi saat modul dimuat — sama seperti branching driver di app.module.ts.
 */
const isSqljs = process.env.DB_DRIVER === 'sqljs';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'seller_id' })
  sellerId!: string;

  @ManyToOne(() => Seller, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'seller_id' })
  seller?: Seller;

  @Column({ type: 'varchar', length: 60 })
  category!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  /** Harga satuan (rupiah, int >= 0). */
  @Column({ type: 'int' })
  price!: number;

  /** Stok tersedia (int >= 0). Didekrement di modul cart/checkout (MP-02). */
  @Column({ type: 'int', default: 0 })
  stock!: number;

  /**
   * Varian produk (ST-05, opsional, maks 10).
   * simple-json agar portabel Postgres/sqljs-test. null/[] = tanpa varian.
   * Validasi bentuk di service (`normalizeProductVariants`).
   */
  @Column({ type: 'simple-json', nullable: true })
  variants?: ProductVariant[] | null;

  /**
   * Badge tampilan (ST-05, manual oleh seller; null = tanpa badge).
   * `best_seller` adalah kurasi manual, bukan komputasi penjualan.
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  badge?: ProductBadge | null;

  /**
   * URL/path foto produk.
   * Postgres: text[] — sqljs-test: simple-array (portabel).
   */
  @Column(
    isSqljs
      ? { type: 'simple-array', nullable: true }
      : { type: 'text', array: true, default: [] as string[] },
  )
  photos?: string[] | null;

  /**
   * Status moderasi. Postgres: varchar + transisi dijaga service.
   * Seller membuat produk langsung `pending`; admin approve/reject.
   */
  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: ProductStatus;

  /** Alasan penolakan admin (diisi saat reject, dibersihkan saat approve). */
  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason?: string | null;

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
