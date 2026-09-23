import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Kunci pengaturan platform yang dikenal (API-W03, allowlist).
 * Nilai disimpan sebagai string di `value` (nullable untuk opsi promo)
 * dan di-parse ke tipe aslinya oleh SettingsService.
 */
export const SETTING_KEYS = [
  'service_fee_enabled',
  'service_fee_amount',
  'commission_percent',
  'commission_promo_percent',
  'commission_promo_until',
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];

/** Nilai default saat tabel masih kosong (di-seed oleh SettingsService). */
export const SETTING_DEFAULTS: Record<SettingKey, string | null> = {
  service_fee_enabled: 'true',
  service_fee_amount: '2500',
  commission_percent: '5',
  commission_promo_percent: null,
  commission_promo_until: null,
};

@Entity('platform_settings')
@Unique('uq_platform_settings_key', ['key'])
export class PlatformSetting {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Kunci unik, salah satu dari SETTING_KEYS. */
  @Column({ type: 'varchar', length: 64, unique: true })
  key!: string;

  /**
   * Nilai mentah (string). `null` = belum di-set (dipakai kunci promo
   * opsional `commission_promo_percent` / `commission_promo_until`).
   */
  @Column({ type: 'text', nullable: true })
  value?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
