/**
 * Unit test modul notifikasi native FCM (PH3-08).
 * - parseNotificationToDeepLink: pure, tanpa native.
 * - Init flow: @react-native-firebase/messaging + PushNotificationIOS dimock;
 *   api client + tokenStorage dimock untuk registerDeviceToken.
 */
import { Platform } from 'react-native';

jest.mock('@react-native-firebase/messaging', () => ({
  AuthorizationStatus: {
    NOT_DETERMINED: -1,
    DENIED: 0,
    AUTHORIZED: 1,
    PROVISIONAL: 2,
    EPHEMERAL: 3,
  },
  getMessaging: jest.fn(() => ({})),
  getToken: jest.fn(),
  requestPermission: jest.fn(),
  onMessage: jest.fn(() => jest.fn()),
  onNotificationOpenedApp: jest.fn(() => jest.fn()),
  onTokenRefresh: jest.fn(() => jest.fn()),
  getInitialNotification: jest.fn(),
  registerDeviceForRemoteMessages: jest.fn(),
  setBackgroundMessageHandler: jest.fn(),
}));

jest.mock('@react-native-community/push-notification-ios', () => ({
  __esModule: true,
  default: { requestPermissions: jest.fn() },
}));

jest.mock('../src/api/client', () => ({
  api: { post: jest.fn() },
}));

jest.mock('../src/api/tokenStorage', () => ({
  getTokens: jest.fn(),
}));

import type { DeepLink } from '../src/config/notifications';

const messaging = require('@react-native-firebase/messaging');
const PushNotificationIOS =
  require('@react-native-community/push-notification-ios').default;
const { api } = require('../src/api/client');
const { getTokens } = require('../src/api/tokenStorage');

const mod = require('../src/config/notifications') as typeof import('../src/config/notifications');
const { parseNotificationToDeepLink } = mod;

describe('parseNotificationToDeepLink (PH3-06, dipertahankan PH3-08)', () => {
  it('venue + entityId → deep-link venue', () => {
    expect(
      parseNotificationToDeepLink({ type: 'venue', entityId: 'venue-1' }),
    ).toEqual({ type: 'venue', entityId: 'venue-1' });
  });

  it('venue tanpa entityId → link tanpa entityId', () => {
    expect(parseNotificationToDeepLink({ type: 'venue' })).toEqual({
      type: 'venue',
    });
  });

  it('booking → deep-link booking (entityId opsional)', () => {
    expect(
      parseNotificationToDeepLink({ type: 'booking', entityId: 'bk-1' }),
    ).toEqual({ type: 'booking', entityId: 'bk-1' });
    expect(parseNotificationToDeepLink({ type: 'booking' })).toEqual({
      type: 'booking',
    });
  });

  it('chat + conversationId eksplisit → conversation', () => {
    expect(
      parseNotificationToDeepLink({
        type: 'chat',
        conversationId: 'conv-1',
        entityId: 'other',
      }),
    ).toEqual({ type: 'chat', chatKind: 'conversation', entityId: 'conv-1' });
  });

  it('chat + partnerId eksplisit → partner', () => {
    expect(
      parseNotificationToDeepLink({ type: 'chat', partnerId: 'user-9' }),
    ).toEqual({ type: 'chat', chatKind: 'partner', entityId: 'user-9' });
  });

  it('chat hanya entityId → conversation (kontrak backend)', () => {
    expect(
      parseNotificationToDeepLink({ type: 'chat', entityId: 'conv-7' }),
    ).toEqual({ type: 'chat', chatKind: 'conversation', entityId: 'conv-7' });
  });

  it('chat tanpa id apa pun → link chat polos', () => {
    expect(parseNotificationToDeepLink({ type: 'chat' })).toEqual({
      type: 'chat',
    });
  });

  it('event + entityId → deep-link event', () => {
    expect(
      parseNotificationToDeepLink({ type: 'event', entityId: 'ev-3' }),
    ).toEqual({ type: 'event', entityId: 'ev-3' });
  });

  it('system → link system tanpa navigasi', () => {
    expect(
      parseNotificationToDeepLink({ type: 'system', entityId: 'x' }),
    ).toEqual({ type: 'system' });
  });

  it('data FCM string-only (RemoteMessage.data) terparse', () => {
    expect(
      parseNotificationToDeepLink({ type: 'chat', entityId: 'conv-7' } as Record<
        string,
        string
      >),
    ).toEqual({ type: 'chat', chatKind: 'conversation', entityId: 'conv-7' });
  });

  it('unknown type / data kosong → null', () => {
    expect(parseNotificationToDeepLink({ type: 'promo' })).toBeNull();
    expect(parseNotificationToDeepLink({})).toBeNull();
    expect(parseNotificationToDeepLink(null)).toBeNull();
    expect(parseNotificationToDeepLink(undefined)).toBeNull();
    expect(parseNotificationToDeepLink('chat' as unknown as Record<string, unknown>)).toBeNull();
    expect(parseNotificationToDeepLink({ type: '' })).toBeNull();
  });
});

describe('requestNotificationPermissions (PH3-08)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Android: AUTHORIZED → granted true', async () => {
    Platform.OS = 'android';
    messaging.requestPermission.mockResolvedValue(1); // AUTHORIZED
    await expect(mod.requestNotificationPermissions()).resolves.toEqual({
      granted: true,
    });
  });

  it('Android: DENIED → granted false', async () => {
    Platform.OS = 'android';
    messaging.requestPermission.mockResolvedValue(0); // DENIED
    await expect(mod.requestNotificationPermissions()).resolves.toEqual({
      granted: false,
    });
  });

  it('Android: PROVISIONAL → granted true', async () => {
    Platform.OS = 'android';
    messaging.requestPermission.mockResolvedValue(2); // PROVISIONAL
    await expect(mod.requestNotificationPermissions()).resolves.toEqual({
      granted: true,
    });
  });

  it('iOS: requestPermissions alert → granted true', async () => {
    Platform.OS = 'ios';
    PushNotificationIOS.requestPermissions.mockResolvedValue({
      alert: true,
      badge: true,
      sound: true,
    });
    await expect(mod.requestNotificationPermissions()).resolves.toEqual({
      granted: true,
    });
    expect(PushNotificationIOS.requestPermissions).toHaveBeenCalled();
  });

  it('iOS: semua false → granted false', async () => {
    Platform.OS = 'ios';
    PushNotificationIOS.requestPermissions.mockResolvedValue({
      alert: false,
      badge: false,
      sound: false,
    });
    await expect(mod.requestNotificationPermissions()).resolves.toEqual({
      granted: false,
    });
  });
});

describe('getDeviceToken + registerDeviceToken (PH3-08)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'android';
  });

  it('getDeviceToken → FCM token', async () => {
    messaging.getToken.mockResolvedValue('fcm-token-abc');
    await expect(mod.getDeviceToken()).resolves.toBe('fcm-token-abc');
  });

  it('getDeviceToken gagal → null', async () => {
    messaging.getToken.mockRejectedValue(new Error('no json'));
    await expect(mod.getDeviceToken()).resolves.toBeNull();
  });

  it('registerDeviceToken POST /notifications/register', async () => {
    getTokens.mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' });
    api.post.mockResolvedValue({ data: {} });
    await expect(mod.registerDeviceToken('fcm-token-abc')).resolves.toBe(true);
    expect(api.post).toHaveBeenCalledWith(
      '/notifications/register',
      expect.objectContaining({ token: 'fcm-token-abc', platform: 'android' }),
      expect.anything(),
    );
  });

  it('registerDeviceToken tanpa accessToken → false, tanpa POST', async () => {
    getTokens.mockResolvedValue({ accessToken: null, refreshToken: null });
    await expect(mod.registerDeviceToken('fcm-token-abc')).resolves.toBe(false);
    expect(api.post).not.toHaveBeenCalled();
  });
});

describe('initializeNotifications flow (PH3-08)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'android';
    mod.cleanupNotificationListeners();
  });

  afterEach(() => {
    mod.cleanupNotificationListeners();
  });

  it('permission granted → get token → register → tap background → onTap', async () => {
    messaging.requestPermission.mockResolvedValue(1);
    messaging.getToken.mockResolvedValue('fcm-t');
    messaging.getInitialNotification.mockResolvedValue(null);
    getTokens.mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' });
    api.post.mockResolvedValue({ data: {} });

    let openedListener: ((msg: unknown) => void) | undefined;
    messaging.onNotificationOpenedApp.mockImplementation(
      (_m: unknown, cb: (msg: unknown) => void) => {
        openedListener = cb;
        return jest.fn();
      },
    );

    const taps: DeepLink[] = [];
    await mod.initializeNotifications((link: DeepLink) => taps.push(link));

    expect(messaging.getToken).toHaveBeenCalled();
    expect(api.post).toHaveBeenCalledWith(
      '/notifications/register',
      expect.objectContaining({ token: 'fcm-t' }),
      expect.anything(),
    );

    if (openedListener) openedListener({ data: { type: 'venue', entityId: 'v-1' } });
    expect(taps).toEqual([{ type: 'venue', entityId: 'v-1' }]);
  });

  it('cold start via getInitialNotification → onTap', async () => {
    messaging.requestPermission.mockResolvedValue(1);
    messaging.getToken.mockResolvedValue('fcm-t');
    getTokens.mockResolvedValue({ accessToken: null, refreshToken: null });
    messaging.getInitialNotification.mockResolvedValue({
      data: { type: 'booking' },
    });

    const taps: DeepLink[] = [];
    await mod.initializeNotifications((link: DeepLink) => taps.push(link));
    expect(taps).toEqual([{ type: 'booking' }]);
  });

  it('permission denied → berhenti, tanpa getToken', async () => {
    messaging.requestPermission.mockResolvedValue(0);
    messaging.getInitialNotification.mockResolvedValue(null);
    await mod.initializeNotifications(jest.fn());
    expect(messaging.getToken).not.toHaveBeenCalled();
    expect(messaging.onMessage).not.toHaveBeenCalled();
  });

  it('foreground message diteruskan ke callback', async () => {
    messaging.requestPermission.mockResolvedValue(1);
    messaging.getToken.mockResolvedValue('fcm-t');
    messaging.getInitialNotification.mockResolvedValue(null);
    getTokens.mockResolvedValue({ accessToken: null, refreshToken: null });

    let fgListener: ((msg: unknown) => void) | undefined;
    messaging.onMessage.mockImplementation(
      (_m: unknown, cb: (msg: unknown) => void) => {
        fgListener = cb;
        return jest.fn();
      },
    );

    const seen: unknown[] = [];
    await mod.initializeNotifications(undefined, (msg: unknown) =>
      seen.push(msg),
    );
    const msg = { messageId: 'm1', data: { type: 'system' } };
    if (fgListener) fgListener(msg);
    expect(seen).toEqual([msg]);
  });

  it('cleanupNotificationListeners unsubscribe semua', async () => {
    messaging.requestPermission.mockResolvedValue(1);
    messaging.getToken.mockResolvedValue('fcm-t');
    messaging.getInitialNotification.mockResolvedValue(null);
    getTokens.mockResolvedValue({ accessToken: null, refreshToken: null });
    const unsubs = [jest.fn(), jest.fn(), jest.fn()];
    messaging.onTokenRefresh.mockImplementation(() => unsubs[0]);
    messaging.onMessage.mockImplementation(() => unsubs[1]);
    messaging.onNotificationOpenedApp.mockImplementation(() => unsubs[2]);

    await mod.initializeNotifications(jest.fn());
    mod.cleanupNotificationListeners();
    for (const u of unsubs) expect(u).toHaveBeenCalled();
  });

  it('registerBackgroundMessageHandler idempotent', () => {
    mod.registerBackgroundMessageHandler();
    mod.registerBackgroundMessageHandler();
    expect(messaging.setBackgroundMessageHandler).toHaveBeenCalledTimes(1);
  });
});
