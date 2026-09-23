import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Venue } from './venue.entity';

/** Jenis dokumen legalitas venue (API-W01). */
export type VenueDocumentType =
  | 'siup'
  | 'nib'
  | 'imb'
  | 'sertifikat_tanah'
  | 'mou_lainnya';

export const VENUE_DOCUMENT_TYPES: VenueDocumentType[] = [
  'siup',
  'nib',
  'imb',
  'sertifikat_tanah',
  'mou_lainnya',
];

/** Status verifikasi dokumen (API-W01). Default `pending`. */
export type VenueDocumentStatus = 'pending' | 'verified' | 'rejected';

export const VENUE_DOCUMENT_STATUSES: VenueDocumentStatus[] = [
  'pending',
  'verified',
  'rejected',
];

@Entity('venue_documents')
export class VenueDocument {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'venue_id' })
  venueId!: string;

  @ManyToOne(() => Venue, (venue) => venue.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'venue_id' })
  venue?: Venue;

  @Column({ type: 'varchar', length: 30 })
  type!: VenueDocumentType;

  /**
   * URL/path file dokumen. Pola ST-01 (sama seperti foto venue):
   * hanya path `/uploads/...` atau URL `https` eksternal.
   */
  @Column({ type: 'text' })
  url!: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: VenueDocumentStatus;

  /** Catatan admin saat verify/reject (opsional). */
  @Column({ type: 'text', nullable: true })
  note?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
