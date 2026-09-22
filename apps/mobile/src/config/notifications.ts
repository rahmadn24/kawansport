/**
 * Push Notifications — native FCM murni (PH3-08).
 *
 * Menggantikan expo-notifications / expo-device / expo-constants:
 * - Permission: Android 13+ (POST_NOTIFICATIONS) via
 *   `@react-native-firebase/messaging` requestPermission;
 *   iOS via `@react-native-community/push-notification-ios` requestPermissions.
 * - Token: FCM registration token via getToken(getMessaging()).
 *   Token didaftarkan ke backend: POST /notifications/register
 *   { token, platform, deviceId?, appVersion? }.
 * - Foreground: onMessage → log + teruskan ke callback. Tray sistem saat
 *   foreground TIDAK ditampilkan manual (tanpa dep notif lokal baru);
 *   notifikasi tray diserahkan ke FCM `notification` payload dari server.
 * - Tap: onNotificationOpenedApp + getInitialNotification (cold start)
 *   → parse ke DeepLink → onTap(deepLink).
 * - Background/quit: setBackgroundMessageHandler WAJIB dipanggil di top-level
 *   (lihat index.js → registerBackgroundMessageHandler()).
 */

import { Platform } from 'react-native';
import {
  AuthorizationStatus,
  getInitialNotification,
  getMessaging,
  getToken,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  registerDeviceForRemoteMessages,
  requestPermission,
  setBackgroundMessageHandler,
  type RemoteMessage,
} from '@react-native-firebase/messaging';
import PushNotificationIOS from '@react-native-community/push-notification-ios';
import { api } from '../api/client';
import { getTokens } from '../api/tokenStorage';

export interface NotificationData {
  type: 'venue' | 'booking' | 'chat' | 'event' | 'system';
  entityId?: string;
  entityType?: string;
  action?: string;
  [key: string]: unknown;
}

/** RemoteMessage FCM yang diteruskan ke callback foreground. */
export type ForegroundMessage = RemoteMessage;

/**
 * Deep-link hasil tap notifikasi (PH3-06, pure — tanpa dependency native).
 * Dikonsumsi LoggedIn di App.tsx: venue/booking/chat/event → tab + route,
 * system → abaikan (tetap di tab aktif).
 */
export interface DeepLink {
  type: 'venue' | 'booking' | 'chat' | 'event' | 'system';
  /** venueId | bookingId | conversationId-or-partnerId | eventId. */
  entityId?: string;
  /** chat saja: apakah entityId adalah conversationId atau partnerId. */
  chatKind?: 'conversation' | 'partner';
}

const DEEP_LINK_TYPES: ReadonlyArray<DeepLink['type']> = [
  'venue',
  'booking',
  'chat',
  'event',
  'system',
];

function asNonEmptyString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

/**
 * Parse payload `data` notifikasi menjadi DeepLink (pure, testable).
 * - type tak dikenal / data kosong → null (diabaikan pemanggil).
 * - system → { type: 'system' } (tanpa navigasi).
 * - chat: kunci eksplisit `conversationId` / `partnerId` diutamakan;
 *   bila hanya ada `entityId`, kontrak backend = conversationId.
 * - venue/booking/event tanpa entityId → link tanpa entityId
 *   (pemanggil memutuskan: booking tetap buka tab mine, lainnya abaikan).
 *
 * Nilai data FCM selalu string (RemoteMessage['data']), kompatibel karena
 * parameter bertipe Record<string, unknown>.
 */
export function parseNotificationToDeepLink(
  data: NotificationData | Record<string, unknown> | null | undefined,
): DeepLink | null {
  if (!data || typeof data !== 'object') return null;
  const raw = data as Record<string, unknown>;
  const type = asNonEmptyString(raw.type);
  if (!type || !DEEP_LINK_TYPES.includes(type as DeepLink['type'])) return null;
  if (type === 'system') return { type: 'system' };
  if (type === 'chat') {
    const conversationId = asNonEmptyString(raw.conversationId);
    if (conversationId) {
      return { type: 'chat', chatKind: 'conversation', entityId: conversationId };
    }
    const partnerId = asNonEmptyString(raw.partnerId);
    if (partnerId) {
      return { type: 'chat', chatKind: 'partner', entityId: partnerId };
    }
    const entityId = asNonEmptyString(raw.entityId);
    return entityId
      ? { type: 'chat', chatKind: 'conversation', entityId }
      : { type: 'chat' };
  }
  const linkType = type as 'venue' | 'booking' | 'event';
  const entityId = asNonEmptyString(raw.entityId);
  return entityId ? { type: linkType, entityId } : { type: linkType };
}

export interface PushTokenPayload {
  token: string;
  platform: 'ios' | 'android';
  deviceId?: string;
  appVersion?: string;
}

type Unsubscribe = () => void;

let unsubscribers: Unsubscribe[] = [];
let backgroundHandlerRegistered = false;

/**
 * Minta izin notifikasi dari user.
 * - iOS: PushNotificationIOS.requestPermissions (alert/badge/sound).
 * - Android: requestPermission(getMessaging()) — mencakup POST_NOTIFICATIONS
 *   di Android 13+.
 * Returns: { granted: boolean }.
 */
export async function requestNotificationPermissions(): Promise<{
  granted: boolean;
}> {
  try {
    if (Platform.OS === 'ios') {
      try {
        await registerDeviceForRemoteMessages(getMessaging());
      } catch {
        // Simulator / APNs belum siap — lanjut ke request permission.
      }
      const perms = await PushNotificationIOS.requestPermissions();
      const granted = !!(perms.alert || perms.badge || perms.sound);
      if (!granted) console.log('Izin notifikasi tidak diberikan');
      return { granted };
    }
    const status = await requestPermission(getMessaging());
    const granted =
      status === AuthorizationStatus.AUTHORIZED ||
      status === AuthorizationStatus.PROVISIONAL;
    if (!granted) console.log('Izin notifikasi tidak diberikan');
    return { granted };
  } catch (error) {
    console.log('Gagal meminta izin notifikasi:', error);
    return { granted: false };
  }
}

/**
 * Dapatkan FCM registration token untuk device ini.
 * Return null bila gagal (mis. google-services.json belum dipasang).
 */
export async function getDeviceToken(): Promise<string | null> {
  try {
    return await getToken(getMessaging());
  } catch (error) {
    console.error('Gagal mendapatkan FCM token:', error);
    return null;
  }
}

/**
 * Register device token (FCM registration token) ke backend.
 * POST /notifications/register { token, platform, deviceId?, appVersion? }.
 *
 * deviceId: react-native-device-info TIDAK dipakai (dep native baru dilarang
 * PH3-08) → dikirim undefined. appVersion: tidak ada sumber versi tanpa
 * expo-constants → dikirim undefined (backend opsional).
 */
export async function registerDeviceToken(token: string): Promise<boolean> {
  try {
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';

    const payload: PushTokenPayload = {
      token,
      platform,
      deviceId: undefined,
      appVersion: undefined,
    };

    const { accessToken } = await getTokens();
    if (!accessToken) {
      console.log('Tidak ada access token, skip register device token');
      return false;
    }

    await api.post('/notifications/register', payload, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    console.log('Device token registered successfully');
    return true;
  } catch (error) {
    console.error('Gagal register device token:', error);
    return false;
  }
}

/**
 * Registrasi background message handler. WAJIB dipanggil di top-level
 * (index.js), bukan di dalam komponen/effect — pola RN Firebase.
 * Idempotent: aman dipanggil lebih dari sekali.
 */
export function registerBackgroundMessageHandler(): void {
  if (backgroundHandlerRegistered) return;
  backgroundHandlerRegistered = true;
  setBackgroundMessageHandler(getMessaging(), async (message) => {
    console.log('FCM background message:', message.messageId, message.data);
  });
}

/**
 * Inisialisasi push notifications lengkap (dipanggil setelah login):
 * - Request permission
 * - Get FCM token → register ke backend
 * - Auto re-register saat token refresh
 * - Foreground: onMessage → log + teruskan ke onForegroundMessage
 * - Tap (background & cold start): parse data → onTap(deepLink)
 */
export async function initializeNotifications(
  onTap?: (link: DeepLink) => void,
  onForegroundMessage?: (message: ForegroundMessage) => void,
): Promise<void> {
  try {
    // 1. Request permissions
    const { granted } = await requestNotificationPermissions();
    if (!granted) {
      console.log('Notification permission denied');
      return;
    }

    // 2. Get FCM token → register ke backend
    const token = await getDeviceToken();
    if (token) {
      await registerDeviceToken(token);
    }

    // 3. Re-register otomatis saat FCM merotasi token
    unsubscribers.push(
      onTokenRefresh(getMessaging(), (newToken) => {
        registerDeviceToken(newToken).catch(() => undefined);
      }),
    );

    // 4. Foreground: log + teruskan ke callback (tanpa notif lokal manual —
    //    tray sistem diserahkan ke FCM notification payload dari server).
    unsubscribers.push(
      onMessage(getMessaging(), (message) => {
        console.log('Notification received (foreground):', message.messageId, message.data);
        onForegroundMessage?.(message);
      }),
    );

    // 5. Tap saat app background → parse ke DeepLink
    unsubscribers.push(
      onNotificationOpenedApp(getMessaging(), (message) => {
        const link = parseNotificationToDeepLink(
          (message.data ?? {}) as Record<string, unknown>,
        );
        if (link) onTap?.(link);
      }),
    );

    // 6. Cold start: app dibuka dari quit state via tap notifikasi
    const initial = await getInitialNotification(getMessaging());
    if (initial) {
      const link = parseNotificationToDeepLink(
        (initial.data ?? {}) as Record<string, unknown>,
      );
      if (link) onTap?.(link);
    }

    console.log('Push notifications initialized successfully');
  } catch (error) {
    console.error('Error initializing notifications:', error);
  }
}

/**
 * Cleanup listeners (panggil saat app unmount/logout).
 */
export function cleanupNotificationListeners(): void {
  for (const unsub of unsubscribers) {
    try {
      unsub();
    } catch {
      // Best-effort cleanup.
    }
  }
  unsubscribers = [];
}
