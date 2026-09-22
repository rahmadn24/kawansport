import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * true saat berjalan di atas sql.js in-memory (hanya untuk e2e test tanpa Postgres).
 * Dievaluasi saat modul dimuat — sama seperti branching driver di app.module.ts.
 */
const isSqljs = process.env.DB_DRIVER === 'sqljs';
/**
 * Percakapan 1-1 (SM-07). userA/userB SELALU disimpan terurut (leksikografis)
 * sehingga pasangan (X,Y) == (Y,X), diperkuat unique constraint pair.
 */
@Entity('conversations')
@Index('uq_conversations_pair', ['userA', 'userB'], { unique: true })
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_a', type: 'varchar', length: 36 })
  userA!: string;

  @Column({ name: 'user_b', type: 'varchar', length: 36 })
  userB!: string;

  @Column(
    isSqljs
      ? { name: 'last_message_at', type: 'datetime', nullable: true }
      : { name: 'last_message_at', type: 'timestamptz', nullable: true },
  )
  lastMessageAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

/** Urutkan pasangan user agar (a,b) dan (b,a) memetakan ke baris yang sama. */
export function sortPair(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a];
}
