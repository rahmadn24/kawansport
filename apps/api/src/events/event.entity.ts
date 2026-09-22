import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

/** Status slot event — dihitung service dari participants_count vs capacity. */
export type EventStatus = 'open' | 'full';

export const EVENT_STATUSES: EventStatus[] = ['open', 'full'];

/**
 * true saat berjalan di atas sql.js in-memory (hanya untuk e2e test tanpa Postgres).
 * Dievaluasi saat modul dimuat — sama seperti branching driver di app.module.ts.
 */
const isSqljs = process.env.DB_DRIVER === 'sqljs';

@Entity('events')
export class SportEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'host_id' })
  hostId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'host_id' })
  host?: User;

  @Column({ type: 'varchar', length: 60 })
  sport!: string;

  @Column({ type: 'varchar', length: 120 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column(isSqljs ? { type: 'datetime' } : { type: 'timestamptz' })
  datetime!: Date;

  @Column(isSqljs ? { type: 'float' } : { type: 'double precision' })
  lat!: number;

  @Column(isSqljs ? { type: 'float' } : { type: 'double precision' })
  lng!: number;

  /**
   * Titik geografis turunan dari lat/lng (SM-04).
   * Postgres: geography(Point,4326) — queryable via PostGIS (ST_DWithin dkk).
   * sqljs-test: varchar berisi WKT `POINT(lng lat)` agar kolom tetap terisi.
   * GIST index dibuat via ensureSpatialIndex() di EventsService (postgres only).
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

  @Column({ type: 'int' })
  capacity!: number;

  /** Jumlah peserta saat ini. SM-04: selalu 0 (join logic = SM-05). */
  @Column({ name: 'participants_count', type: 'int', default: 0 })
  participantsCount!: number;

  /**
   * Status slot. Postgres: varchar + CHECK via service (open/full).
   * Dihitung service: participants_count >= capacity ? 'full' : 'open'.
   */
  @Column({ type: 'varchar', length: 10, default: 'open' })
  status!: EventStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

/** Aturan status tunggal agar konsisten dipakai create + (nanti) SM-05 join/leave. */
export function resolveEventStatus(
  participantsCount: number,
  capacity: number,
): EventStatus {
  return participantsCount >= capacity ? 'full' : 'open';
}
