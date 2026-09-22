/**
 * Pembungkus GPS (SM-03).
 *
 * Memakai `navigator.geolocation` global bila tersedia. Di React Native,
 * pasang `@react-native-community/geolocation` (lalu panggil
 * `Geolocation.setRNConfiguration()` / polyfill ke navigator) agar
 * tombol "Gunakan GPS" berfungsi di perangkat. Tanpa provider,
 * promise ditolak dengan pesan yang jelas (tidak crash).
 */

export interface GpsCoordinates {
  latitude: number;
  longitude: number;
}

interface GeolocationLike {
  getCurrentPosition(
    success: (pos: { coords: { latitude: number; longitude: number } }) => void,
    error?: (err: { message?: string; code?: number }) => void,
    options?: { timeout?: number; maximumAge?: number; enableHighAccuracy?: boolean },
  ): void;
}

function resolveProvider(): GeolocationLike | null {
  // Paket community (opsional) — di-resolve dinamis agar tidak wajib terinstal.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const community = require('@react-native-community/geolocation');
    const geo = community?.default ?? community;
    if (geo && typeof geo.getCurrentPosition === 'function') return geo as GeolocationLike;
  } catch {
    // Paket belum dipasang — lanjut ke fallback navigator.
  }
  const nav =
    (globalThis as { navigator?: { geolocation?: GeolocationLike } }).navigator?.geolocation;
  if (nav && typeof nav.getCurrentPosition === 'function') return nav;
  return null;
}

/** Minta satu titik lokasi perangkat. Timeout default 15 detik. */
export function getCurrentPosition(timeoutMs = 15000): Promise<GpsCoordinates> {
  const provider = resolveProvider();
  if (!provider) {
    return Promise.reject(
      new Error(
        'GPS tidak tersedia. Pasang @react-native-community/geolocation atau isi lat/lng manual.',
      ),
    );
  }
  return new Promise((resolve, reject) => {
    provider.getCurrentPosition(
      (pos) =>
        resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => reject(new Error(err?.message || 'Gagal mendapatkan lokasi GPS')),
      { timeout: timeoutMs, maximumAge: 60000, enableHighAccuracy: false },
    );
  });
}
