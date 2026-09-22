/**
 * Penyimpanan token aman (SM-02).
 *
 * Memakai react-native-encrypted-storage (Keychain di iOS / EncryptedSharedPreferences
 * + Keystore di Android). Di lingkungan tanpa native module (jest), otomatis fallback
 * ke penyimpanan in-memory sehingga logika auth tetap bisa diuji.
 */
import EncryptedStorage from 'react-native-encrypted-storage';

export interface AuthTokens {
  accessToken: string | null;
  refreshToken: string | null;
}

const ACCESS_KEY = 'sm.accessToken';
const REFRESH_KEY = 'sm.refreshToken';

const memory = new Map<string, string>();
let nativeAvailable: boolean | null = null;

function isNativeAvailable(): boolean {
  if (nativeAvailable !== null) return nativeAvailable;
  try {
    nativeAvailable =
      !!EncryptedStorage &&
      typeof (EncryptedStorage as { getItem?: unknown }).getItem === 'function';
  } catch {
    nativeAvailable = false;
  }
  return nativeAvailable;
}

/** Dipakai test untuk memaksa mode in-memory. */
export function __forceMemoryFallback() {
  nativeAvailable = false;
  memory.clear();
}

export async function getTokens(): Promise<AuthTokens> {
  if (!isNativeAvailable()) {
    return {
      accessToken: memory.get(ACCESS_KEY) ?? null,
      refreshToken: memory.get(REFRESH_KEY) ?? null,
    };
  }
  try {
    const [accessToken, refreshToken] = await Promise.all([
      EncryptedStorage.getItem(ACCESS_KEY),
      EncryptedStorage.getItem(REFRESH_KEY),
    ]);
    return { accessToken, refreshToken };
  } catch {
    return {
      accessToken: memory.get(ACCESS_KEY) ?? null,
      refreshToken: memory.get(REFRESH_KEY) ?? null,
    };
  }
}

export async function setTokens(tokens: AuthTokens): Promise<void> {
  if (tokens.accessToken == null || tokens.refreshToken == null) {
    throw new Error('setTokens requires accessToken and refreshToken');
  }
  if (!isNativeAvailable()) {
    memory.set(ACCESS_KEY, tokens.accessToken);
    memory.set(REFRESH_KEY, tokens.refreshToken);
    return;
  }
  try {
    await Promise.all([
      EncryptedStorage.setItem(ACCESS_KEY, tokens.accessToken),
      EncryptedStorage.setItem(REFRESH_KEY, tokens.refreshToken),
    ]);
  } catch {
    memory.set(ACCESS_KEY, tokens.accessToken);
    memory.set(REFRESH_KEY, tokens.refreshToken);
  }
}

export async function setAccessToken(accessToken: string): Promise<void> {
  if (!isNativeAvailable()) {
    memory.set(ACCESS_KEY, accessToken);
    return;
  }
  try {
    await EncryptedStorage.setItem(ACCESS_KEY, accessToken);
  } catch {
    memory.set(ACCESS_KEY, accessToken);
  }
}

export async function clearTokens(): Promise<void> {
  memory.delete(ACCESS_KEY);
  memory.delete(REFRESH_KEY);
  if (!isNativeAvailable()) return;
  try {
    await Promise.all([
      EncryptedStorage.removeItem(ACCESS_KEY),
      EncryptedStorage.removeItem(REFRESH_KEY),
    ]);
  } catch {
    // Fallback in-memory sudah dibersihkan di atas.
  }
}
