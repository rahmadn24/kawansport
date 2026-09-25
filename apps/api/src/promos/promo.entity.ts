import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Banner promo CMS-managed (ST-09).
 * `active` = kurasi manual admin; `startsAt/endsAt` = jendela tayang
 * opsional (null = tanpa batas). Publik (GET /promos) hanya melihat
 * banner yang aktif DAN di dalam periode.
 */
/**
 * true saat berjalan di atas sql.js in-memory (hanya untuk e2e test tanpa Postgres).
 * Dievaluasi saat modul dimuat — sama seperti branching driver di app.module.ts.
 */
const isSqljs = process.env.DB_DRIVER === 'sqljs';

@Entity('promos')
export class Promo {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 120 })
  title!: string;

  /**
   * Gambar banner — mengikuti aturan ST-01 (path `/uploads/...` atau
   * URL `https`; divalidasi di DTO via `IsPhotoUrl` + service).
   */
  @Column({ name: 'image_url', type: 'varchar', length: 2048 })
  imageUrl!: string;

  /** Tautan opsional (deep-link / URL eksternal), teks bebas maks 2048. */
  @Column({ type: 'varchar', length: 2048, nullable: true })
  link?: string | null;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @Column(
    isSqljs
      ? { name: 'starts_at', type: 'datetime', nullable: true }
      : { name: 'starts_at', type: 'timestamptz', nullable: true },
  )
  startsAt?: Date | null;

  @Column(
    isSqljs
      ? { name: 'ends_at', type: 'datetime', nullable: true }
      : { name: 'ends_at', type: 'timestamptz', nullable: true },
  )
  endsAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
