import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Court } from './court.entity';

/** Status moderasi venue (BK-01). Alur: draft -> pending -> approved | rejected. */
export type VenueStatus = 'draft' | 'pending' | 'approved' | 'rejected';

export const VENUE_STATUSES: VenueStatus[] = [
  'draft',
  'pending',
  'approved',
  'rejected',
];

/**
 * true saat berjalan di atas sql.js in-memory (hanya untuk e2e test tanpa Postgres).
 * Dievaluasi saat modul dimuat — sama seperti branching driver di app.module.ts.
 */
const isSqljs = process.env.DB_DRIVER === 'sqljs';

@Entity('venues')
export class Venue {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'text' })
  address!: string;

  @Column(isSqljs ? { type: 'float' } : { type: 'double precision' })
  lat!: number;

  @Column(isSqljs ? { type: 'float' } : { type: 'double precision' })
  lng!: number;

  /**
   * Titik geografis turunan dari lat/lng (BK-01).
   * Postgres: geography(Point,4326) — queryable via PostGIS (ST_DWithin dkk).
   * sqljs-test: varchar berisi WKT `POINT(lng lat)` agar kolom tetap terisi.
   * GIST index dibuat via onModuleInit() di VenuesService (postgres only).
   */
  @Column(
    isSqljs
      ? { type: 'varchar', length: 64, nullable: true }
      : {
          type: 'geography',
          spatialFeatureType: 'Point',
          srid: 4326,
          nullable: true,
        },
  )
  location?: unknown;

  /**
   * Cabang olahraga yang tersedia di venue.
   * Postgres: text[] — sqljs-test: simple-array (portabel, comma-separated).
   */
  @Column(
    isSqljs
      ? { type: 'simple-array', nullable: true }
      : { type: 'text', array: true, default: [] as string[] },
  )
  sports?: string[] | null;

  /**
   * URL/path foto venue.
   * Postgres: text[] — sqljs-test: simple-array (portabel).
   */
  @Column(
    isSqljs
      ? { type: 'simple-array', nullable: true }
      : { type: 'text', array: true, default: [] as string[] },
  )
  photos?: string[] | null;

  @Column({ name: 'owner_id' })
  ownerId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner?: User;

  /**
   * Status moderasi. Postgres: varchar + transisi dijaga service.
   * Default `draft`; venue_owner yang membuat langsung `pending`.
   */
  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status!: VenueStatus;

  /** Alasan penolakan admin (diisi saat reject, dibersihkan saat approve). */
  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason?: string | null;

  /**
   * Id user yang terakhir mengubah (AD-02, jejak audit).
   * Diisi editor langsung maupun admin saat approve change request.
   */
  @Column({ name: 'updated_by', type: 'varchar', nullable: true })
  updatedBy?: string | null;

  @OneToMany(() => Court, (court) => court.venue)
  courts?: Court[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
