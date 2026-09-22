import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Tingkat skill user — disimpan sebagai enum postgres / varchar (sqljs-test). */
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';

export const SKILL_LEVELS: SkillLevel[] = [
  'beginner',
  'intermediate',
  'advanced',
];

/**
 * Role RBAC (AD-01).
 * - super_admin: akses penuh CMS/admin (mis. GET /admin/ping).
 * - venue_owner: pemilik venue (scope BK/MP fase berikut).
 * - seller: penjual marketplace (scope MP fase berikut).
 * - user: default semua user baru.
 */
export type UserRole = 'super_admin' | 'venue_owner' | 'seller' | 'user';

export const USER_ROLES: UserRole[] = [
  'super_admin',
  'venue_owner',
  'seller',
  'user',
];

/**
 * true saat berjalan di atas sql.js in-memory (hanya untuk e2e test tanpa Postgres).
 * Dievaluasi saat modul dimuat — sama seperti branching driver di app.module.ts.
 */
const isSqljs = process.env.DB_DRIVER === 'sqljs';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ name: 'password_hash' })
  passwordHash!: string;

  @Column({ name: 'display_name', nullable: true })
  displayName?: string;

  /**
   * Olahraga favorit (SM-03).
   * Postgres: text[] — sqljs-test: simple-array (portabel, comma-separated).
   */
  @Column(
    isSqljs
      ? { type: 'simple-array', nullable: true }
      : { type: 'text', array: true, default: [] as string[] },
  )
  sports?: string[] | null;

  /** Skill level (SM-03). Postgres: enum — sqljs-test: varchar + validasi di DTO. */
  @Column(
    isSqljs
      ? { type: 'varchar', length: 20, nullable: true }
      : { type: 'enum', enum: SKILL_LEVELS, nullable: true },
  )
  skillLevel?: SkillLevel | null;

  /** Latitude (SM-03). null = lokasi belum diisi / dihapus. */
  @Column(
    isSqljs
      ? { type: 'float', nullable: true }
      : { type: 'double precision', nullable: true },
  )
  lat?: number | null;

  /** Longitude (SM-03). Selalu diisi/dihapus berpasangan dengan lat. */
  @Column(
    isSqljs
      ? { type: 'float', nullable: true }
      : { type: 'double precision', nullable: true },
  )
  lng?: number | null;

  /**
   * Titik geografis turunan dari lat/lng (SM-03).
   * Postgres: geography(Point,4326) — queryable via PostGIS (ST_DWithin dkk).
   * sqljs-test: varchar berisi WKT `POINT(lng lat)` agar kolom tetap terisi.
   * GIST index dibuat via ensureSpatialIndex() di UsersService (postgres only).
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

  /** Path URL publik avatar, mis. `/uploads/avatars/<file>` (SM-03). */
  @Column({ name: 'avatar_url', type: 'varchar', nullable: true })
  avatarUrl?: string | null;

  /**
   * Role RBAC (AD-01). Default `user` untuk semua user baru.
   * Postgres: enum — sqljs-test: varchar agar portabel.
   */
  @Column(
    isSqljs
      ? { type: 'varchar', length: 20, default: 'user' }
      : { type: 'enum', enum: USER_ROLES, default: 'user' },
  )
  role!: UserRole;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  /**
   * Terakhir login/refresh (digunakan untuk metrik active users AD-03).
   * Di-set saat login/refresh token.
   */
  @Column(
    isSqljs
      ? { name: 'last_login_at', type: 'datetime', nullable: true }
      : {
          name: 'last_login_at',
          type: 'timestamptz',
          nullable: true,
        },
  )
  lastLoginAt?: Date | null;
}
