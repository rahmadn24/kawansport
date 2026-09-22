/**
 * Konfigurasi global mobile KawanSport (PH3-07).
 *
 * API_URL = base URL backend (tanpa trailing slash).
 *
 * - iOS simulator / Metro di Mac yg sama: `http://localhost:3000` (default).
 * - Emulator Android: `http://10.0.2.2:3000` (localhost emulator = dirinya
 *   sendiri, bukan Mac host).
 * - HP fisik (Expo Go / dev build, satu Wi-Fi dengan Mac): ganti ke IP LAN
 *   Mac, mis. `http://192.168.1.5:3000` — cek IP via `ipconfig getifaddr en0`.
 *
 * Tanpa dependency native baru: cukup edit satu baris di bawah.
 */
export const API_URL = 'http://localhost:3000';
