import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../users/user.entity';
import { SportEvent } from './event.entity';

/**
 * Status antrean (ST-03): `waiting` = menunggu slot, `invited` = slot kosong
 * dan user ini terdepan — dipromosi otomatis oleh `EventsService.leave`.
 *
 * TODO(V2): undangan kedaluwarsa (saat ini undangan tidak kedaluwarsa —
 * user invited tinggal join seperti biasa karena slot sudah kosong).
 */
export type WaitlistStatus = 'waiting' | 'invited';

export const WAITLIST_STATUSES: WaitlistStatus[] = ['waiting', 'invited'];

/**
 * Antrean tunggu event penuh (ST-03). Pasangan (event_id, user_id) unik —
 * duplikat antrean ditolak 409. `position` = jumlah baris antrean event
 * tersebut + 1 saat dimasukkan (1-based, tidak di-reorder saat ada yang
 * keluar — posisi mencerminkan urutan kedatangan).
 */
@Entity('event_waitlists')
@Unique('uq_event_waitlists_event_user', ['eventId', 'userId'])
export class EventWaitlist {
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

  /** Nomor urut kedatangan (1-based). */
  @Column({ type: 'int' })
  position!: number;

  @Column({ type: 'varchar', length: 10, default: 'waiting' })
  status!: WaitlistStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
