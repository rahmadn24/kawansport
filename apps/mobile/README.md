# KawanSport Mobile (RN bare CLI + TypeScript)

## Push Notifications — native FCM (PH3-08)

Expo dihapus total (`expo-notifications`, `expo-device`, `expo-constants`
di-uninstall). Push memakai `@react-native-firebase/messaging` (Android penuh)
+ `@react-native-community/push-notification-ios` (permission iOS).

### Android — cara mengaktifkan push asli

1. Di [Firebase Console](https://console.firebase.google.com/): buat project
   (atau pakai yg ada) → Add app → Android → package name **`com.kawansport`**.
2. Download **`google-services.json`** → simpan sebagai:
   `apps/mobile/android/app/google-services.json`
   (Struktur contoh: `android/app/google-services.json.example`.
   File asli **jangan di-commit** — sudah di `.gitignore` root.)
3. `cd apps/mobile && npx pod-install` tidak perlu (Android saja);
   jalankan `npx react-native run-android`.
4. Tanpa file asli, build tetap jalan (plugin `com.google.gms.google-services`
   hanya di-apply bila file ada — lihat `android/app/build.gradle`), tapi
   `getToken()` gagal dan push nonaktif (cek logcat).

SHA-1 debug (bila Firebase meminta):
`cd android && ./gradlew signingReport`.

### iOS — disiapkan, APNs belakangan

Kode JS sudah siap (`PushNotificationIOS.requestPermissions` di
`src/config/notifications.ts`). Agar push iOS asli jalan, user perlu:

1. Firebase Console → Project settings → iOS app (`com.kawansport`,
   buat bila belum ada) → download **`GoogleService-Info.plist`** →
   taruh di `apps/mobile/ios/KawanSport/GoogleService-Info.plist`
   (jangan di-commit — sudah di `.gitignore`).
2. Upload **APNs Auth Key** (`.p8`, sekali pakai untuk semua app) di
   Firebase Console → Project settings → Cloud Messaging → APNs Authentication Key
   (butuh Apple Developer Membership + Key ID + Team ID).
3. Di Xcode, target **KawanSport** → Signing & Capabilities → tambah:
   **Push Notifications** + **Background Modes** (centang *Remote notifications*).
   (Sengaja tidak diedit manual di `.pbxproj` — rawan konflik; via Xcode.)
4. `cd ios && pod install`, lalu `run-ios` di device fisik
   (push tidak jalan di simulator).

Catatan: push iOS tetap lewat **FCM** (tidak ada server APNs terpisah —
backend hanya kirim via FCM HTTP v1; FCM yg meneruskan ke APNs).

### Alur kode

- `index.js` → `registerBackgroundMessageHandler()` (top-level, wajib).
- Login → `initializeNotifications(onTap)`:
  permission → `getToken()` → `POST /notifications/register`
  → `onMessage` (foreground: log + callback) →
  `onNotificationOpenedApp` / `getInitialNotification` → `onTap(deepLink)`.
- Tap → `parseNotificationToDeepLink(data)` → `DeepLink` dikonsumsi `App.tsx`.
- Logout/unmount → `cleanupNotificationListeners()`.
