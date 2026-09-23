import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PlatformSetting,
  SETTING_DEFAULTS,
  SETTING_KEYS,
  SettingKey,
} from './platform-setting.entity';

export interface SettingItem {
  key: SettingKey;
  /** Nilai ter-parse (boolean | number | string | null). */
  value: boolean | number | string | null;
  /** Nilai mentah di DB (string | null). */
  raw: string | null;
  updatedAt: Date;
}

/** Hasil baca service fee untuk booking flow. */
export interface ServiceFee {
  enabled: boolean;
  /** Rupiah per booking (integer >= 0). */
  amount: number;
}

function isSettingKey(key: string): key is SettingKey {
  return (SETTING_KEYS as readonly string[]).includes(key);
}

@Injectable()
export class SettingsService implements OnModuleInit {
  constructor(
    @InjectRepository(PlatformSetting)
    private readonly settings: Repository<PlatformSetting>,
  ) {}

  /**
   * Seed-on-boot (API-W03): bila tabel kosong, insert defaults. Satu-satunya
   * tempat seeding settings (JANGAN duplikat di seed.ts) — berjalan di
   * Postgres maupun sqljs e2e (synchronize: true).
   */
  async onModuleInit(): Promise<void> {
    const count = await this.settings.count();
    if (count > 0) return;
    for (const key of SETTING_KEYS) {
      await this.settings.save(
        this.settings.create({ key, value: SETTING_DEFAULTS[key] }),
      );
    }
  }

  /** GET /admin/settings — semua kunci dikenal + nilai ter-parse, urut key. */
  async list(): Promise<{ data: SettingItem[]; meta: { total: number } }> {
    const rows = await this.settings.find();
    const byKey = new Map(rows.map((r) => [r.key, r]));
    const data = SETTING_KEYS.map((key) => {
      const row = byKey.get(key);
      const raw = row?.value ?? SETTING_DEFAULTS[key];
      return {
        key,
        value: parseValue(key, raw),
        raw,
        updatedAt: row?.updatedAt ?? new Date(0),
      };
    });
    return { data, meta: { total: data.length } };
  }

  /**
   * PUT /admin/settings — body Record key->value ter-allowlist.
   * Kunci asing -> 400; tiap nilai divalidasi per tipe (boolean-ish,
   * integer >= 0, percent 0..100, ISO date); null/'' membersihkan promo.
   */
  async update(
    input: Record<string, unknown>,
  ): Promise<{ data: SettingItem[]; meta: { total: number } }> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('body must be an object of settings');
    }
    const keys = Object.keys(input);
    if (keys.length === 0) {
      throw new BadRequestException('body must not be empty');
    }
    for (const key of keys) {
      if (!isSettingKey(key)) {
        throw new BadRequestException(`Unknown setting: ${key}`);
      }
    }
    for (const key of keys) {
      if (!isSettingKey(key)) {
        throw new BadRequestException(`Unknown setting: ${key}`);
      }
      const raw = stringifyValue(key, input[key]);
      let row = await this.settings.findOne({ where: { key } });
      if (!row) {
        row = this.settings.create({ key, value: raw });
      } else {
        row.value = raw;
      }
      await this.settings.save(row);
    }
    return this.list();
  }

  /**
   * Baca service fee untuk booking flow (baca langsung per pemakaian —
   * tanpa cache, sederhana; tidak ada pola cache existing di codebase).
   * Disabled -> amount diabaikan (total tanpa fee).
   */
  async getServiceFee(): Promise<ServiceFee> {
    const rows = await this.settings.find();
    const byKey = new Map(rows.map((r) => [r.key, r.value ?? null]));
    const raw = (k: SettingKey): string | null =>
      byKey.has(k) ? (byKey.get(k) ?? null) : SETTING_DEFAULTS[k];
    return {
      enabled: parseBoolean(raw('service_fee_enabled'), true),
      amount: parseNonNegativeInt(raw('service_fee_amount'), 2500),
    };
  }

  /**
   * Komisi efektif: promo aktif bila `commission_promo_percent` ter-set DAN
   * (`commission_promo_until` kosong / masih di masa depan). Selain itu
   * pakai `commission_percent`. Untuk kebutuhan margin mendatang.
   */
  async getEffectiveCommissionPercent(now = new Date()): Promise<{
    configured: number;
    effective: number;
    promoActive: boolean;
    promoPercent: number | null;
    promoUntil: string | null;
  }> {
    const rows = await this.settings.find();
    const byKey = new Map(rows.map((r) => [r.key, r.value ?? null]));
    const raw = (k: SettingKey): string | null =>
      byKey.has(k) ? (byKey.get(k) ?? null) : SETTING_DEFAULTS[k];
    const configured = parsePercent(raw('commission_percent'), 5);
    const promoRaw = raw('commission_promo_percent');
    const untilRaw = raw('commission_promo_until');
    const promoPercent =
      promoRaw == null || promoRaw === '' ? null : parsePercent(promoRaw, NaN);
    const promoUntil =
      untilRaw == null || untilRaw === '' ? null : String(untilRaw);
    const notExpired =
      promoUntil == null || Number.isNaN(Date.parse(promoUntil))
        ? true
        : Date.parse(promoUntil) >= now.getTime();
    const promoActive =
      promoPercent != null && !Number.isNaN(promoPercent) && notExpired;
    return {
      configured,
      effective: promoActive ? (promoPercent as number) : configured,
      promoActive,
      promoPercent,
      promoUntil,
    };
  }
}

// ---- Parsing & validasi (sumber kebenaran untuk PUT) ----

function parseValue(key: SettingKey, raw: string | null): boolean | number | string | null {
  if (raw == null) return null;
  switch (key) {
    case 'service_fee_enabled':
      return parseBoolean(raw, true);
    case 'service_fee_amount':
      return parseNonNegativeInt(raw, 0);
    case 'commission_percent':
    case 'commission_promo_percent':
      return parsePercent(raw, NaN);
    case 'commission_promo_until':
      return raw;
  }
}

/** Validasi + simpan sebagai string; null/'' -> null (hanya kunci promo). */
function stringifyValue(key: SettingKey, value: unknown): string | null {
  switch (key) {
    case 'service_fee_enabled': {
      const b = toBoolean(value);
      if (b == null) {
        throw new BadRequestException(
          'service_fee_enabled must be boolean-ish (true/false, "true"/"false", 1/0)',
        );
      }
      return b ? 'true' : 'false';
    }
    case 'service_fee_amount': {
      const n = toInteger(value);
      if (n == null || n < 0) {
        throw new BadRequestException(
          'service_fee_amount must be an integer >= 0',
        );
      }
      return String(n);
    }
    case 'commission_percent': {
      const n = toNumber(value);
      if (n == null || Number.isNaN(n) || n < 0 || n > 100) {
        throw new BadRequestException(
          'commission_percent must be a number 0..100',
        );
      }
      return String(n);
    }
    case 'commission_promo_percent': {
      if (value === null || value === undefined || value === '') return null;
      const n = toNumber(value);
      if (n == null || Number.isNaN(n) || n < 0 || n > 100) {
        throw new BadRequestException(
          'commission_promo_percent must be a number 0..100 or null',
        );
      }
      return String(n);
    }
    case 'commission_promo_until': {
      if (value === null || value === undefined || value === '') return null;
      if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
        throw new BadRequestException(
          'commission_promo_until must be an ISO date string or null',
        );
      }
      return new Date(value).toISOString();
    }
  }
}

function toBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (value === 1) return true;
  if (value === 0) return false;
  if (typeof value === 'string') {
    const s = value.trim().toLowerCase();
    if (s === 'true' || s === '1') return true;
    if (s === 'false' || s === '0') return false;
  }
  return null;
}

function toInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value.trim());
    if (Number.isInteger(n)) return n;
  }
  return null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value.trim());
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

function parseBoolean(raw: string | null, fallback: boolean): boolean {
  if (raw == null) return fallback;
  const b = toBoolean(raw);
  return b ?? fallback;
}

function parseNonNegativeInt(raw: string | null, fallback: number): number {
  if (raw == null) return fallback;
  const n = toInteger(raw);
  return n != null && n >= 0 ? n : fallback;
}

function parsePercent(raw: string | null, fallback: number): number {
  if (raw == null || raw === '') return fallback;
  const n = toNumber(raw);
  return n != null && !Number.isNaN(n) && n >= 0 && n <= 100 ? n : fallback;
}
