import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { registerBackgroundMessageHandler } from './src/config/notifications';

// Wajib top-level (di luar lifecycle React): handler pesan FCM saat
// app background/quit. Aman di-skip bila native module belum terpasang.
try {
  registerBackgroundMessageHandler();
} catch {
  // Lingkungan tanpa native FCM (mis. jest) — abaikan.
}

AppRegistry.registerComponent(appName, () => App);
