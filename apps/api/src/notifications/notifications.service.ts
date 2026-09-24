import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from 'firebase-admin/app';
import {
  getMessaging,
  type BatchResponse,
  type Messaging,
} from 'firebase-admin/messaging';
import type { RequestUser } from '../auth/jwt-auth.guard';
import { DeviceToken } from './device-token.entity';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { SendNotificationDto } from './dto/send-notification.dto';
import { NotificationHistory } from './notification-history.entity';

/** Batas token per panggilan FCM multicast (dokumen Firebase). */
const CHUNK_SIZE = 500;

/**
 * Push notification via FCM HTTP v1 (PH3-08, pengganti Expo Push API).
 *
 * - Token yg disimpan = FCM registration token (Android & iOS sama;
 *   tidak perlu migrasi data — tabel DeviceToken tetap).
 * - iOS: TIDAK ada implementasi node-apn terpisah. Setelah app iOS
 *   didaftarkan di project Firebase yg sama + APNs Auth Key diupload
 *   (Firebase Console → Cloud Messaging), FCM otomatis meneruskan pesan
 *   ke APNs. TODO(iOS): tinggal tambah kredensial APNs, tanpa ubah kode ini.
 *
 * MODE STUB: bila `FIREBASE_STUB=true`, tidak ada panggilan jaringan —
 * langsung return { sent: jumlah token, failed: 0 }. Dipakai e2e/dev.
 * Tanpa stub, kredensial dibaca dari (urutan prioritas):
 *   1. `FIREBASE_SERVICE_ACCOUNT_JSON` (isi JSON service account inline)
 *   2. `GOOGLE_APPLICATION_CREDENTIALS` (path file service account)
 * Bila keduanya kosong → mode STUB otomatis (log peringatan sekali).
 */
@Injectable()
export class NotificationsService {
  private fcmLoggedNoCredential = false;

  constructor(
    @InjectRepository(DeviceToken)
    private readonly tokens: Repository<DeviceToken>,
    @InjectRepository(NotificationHistory)
    private readonly history: Repository<NotificationHistory>,
  ) {}

  isStubMode(): boolean {
    if (process.env.FIREBASE_STUB === 'true') return true;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return false;
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return false;
    return true;
  }

  /** Upsert token: token unik global → pindah kepemilikan bila sudah ada. */
  async registerToken(user: RequestUser, dto: RegisterDeviceDto) {
    const existing = await this.tokens.findOne({
      where: { token: dto.token },
    });
    if (existing) {
      existing.userId = user.id;
      existing.platform = dto.platform;
      existing.deviceId = dto.deviceId ?? null;
      existing.appVersion = dto.appVersion ?? null;
      return this.tokens.save(existing);
    }
    const row = this.tokens.create({
      userId: user.id,
      token: dto.token,
      platform: dto.platform,
      deviceId: dto.deviceId ?? null,
      appVersion: dto.appVersion ?? null,
    });
    return this.tokens.save(row);
  }

  /** Inisialisasi firebase-admin sekali (singleton), kecuali mode stub. */
  private getMessaging(): Messaging | null {
    if (this.isStubMode()) {
      if (
        !this.fcmLoggedNoCredential &&
        process.env.FIREBASE_STUB !== 'true'
      ) {
        this.fcmLoggedNoCredential = true;
        console.warn(
          '[Notifications] Kredensial Firebase kosong ' +
            '(FIREBASE_SERVICE_ACCOUNT_JSON / GOOGLE_APPLICATION_CREDENTIALS) — ' +
            'berjalan dalam mode STUB (push hanya di-log).',
        );
      }
      return null;
    }
    if (getApps().length === 0) {
      const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      try {
        if (inline) {
          initializeApp({ credential: cert(JSON.parse(inline)) });
        } else {
          // GOOGLE_APPLICATION_CREDENTIALS (path file) via applicationDefault.
          initializeApp({ credential: applicationDefault() });
        }
      } catch (err) {
        throw new InternalServerErrorException(
          `Firebase init gagal: ${(err as Error).message}`,
        );
      }
    }
    return getMessaging();
  }

  /** Kirim ke semua device milik userIds. Hanya dipanggil dari endpoint super_admin. */
  async sendToUsers(dto: SendNotificationDto): Promise<{ sent: number; failed: number }> {
    // Persistensi minimal GAP-01: riwayat per-user, tanpa mengubah kontrak send.
    // Ditulis untuk SEMUA target userIds (walau tanpa device) sebelum pengiriman.
    const type = dto.data?.type ?? 'system';
    const dataJson = dto.data
      ? (JSON.parse(JSON.stringify(dto.data)) as Record<string, unknown>)
      : null;
    const rowsToSave = dto.userIds.map((userId) =>
      this.history.create({
        userId,
        type,
        title: dto.title,
        body: dto.body,
        data: dataJson,
      }),
    );
    await this.history.save(rowsToSave);

    const rows = await this.tokens.find({
      where: { userId: In(dto.userIds) },
    });
    if (rows.length === 0) return { sent: 0, failed: 0 };

    const messaging = this.getMessaging();
    if (!messaging) return { sent: rows.length, failed: 0 };

    // FCM `data` hanya menerima string → stringify semua nilai.
    const data: Record<string, string> | undefined = dto.data
      ? Object.fromEntries(
          Object.entries(dto.data).map(([k, v]) => [k, String(v)]),
        )
      : undefined;

    let sent = 0;
    let failed = 0;
    const deadTokens: string[] = [];

    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const chunkTokens = chunk.map((r) => r.token);
      let res: BatchResponse;
      try {
        res = await messaging.sendEachForMulticast({
          tokens: chunkTokens,
          notification: { title: dto.title, body: dto.body },
          ...(data ? { data } : {}),
          // Prioritas tinggi agar tray Android langsung tampil.
          android: { priority: 'high' as const },
        });
      } catch (err) {
        throw new InternalServerErrorException(
          `FCM unreachable: ${(err as Error).message}`,
        );
      }
      sent += res.successCount;
      failed += res.failureCount;
      res.responses.forEach((r, idx) => {
        if (
          !r.success &&
          r.error?.code === 'messaging/registration-token-not-registered'
        ) {
          deadTokens.push(chunkTokens[idx]);
        }
      });
    }

    // Best-effort: hapus token yang sudah tidak terdaftar di FCM.
    if (deadTokens.length > 0) {
      await this.tokens.delete({ token: In(deadTokens) }).catch(() => undefined);
    }

    return { sent, failed };
  }

  /** GET /notifications/me — riwayat milik sendiri, terbaru dulu. */
  async listForUser(userId: string, page: number, limit: number) {
    const [rows, total] = await this.history.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data: rows.map((r) => this.toItem(r)),
      meta: { page, limit, total },
    };
  }

  /** POST /notifications/:id/read — milik sendiri saja (lintas user → 404), idempotent. */
  async markRead(userId: string, id: string) {
    const row = await this.history.findOne({ where: { id, userId } });
    if (!row) throw new NotFoundException('Notification not found');
    if (!row.readAt) {
      row.readAt = new Date();
      await this.history.save(row);
    }
    return this.toItem(row);
  }

  private toItem(r: NotificationHistory) {
    return {
      id: r.id,
      type: r.type,
      title: r.title,
      body: r.body,
      data: r.data ?? null,
      readAt: r.readAt ?? null,
      createdAt: r.createdAt,
    };
  }
}
