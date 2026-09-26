// Searchable index of Settings pages. Hardware-specific pages appear only when the capability exists.
import { has } from '../core/capabilities.js';
import { settings } from '../core/store.js';

export const ROW_COLORS = {
  wifi: '#2f7ad8', bluetooth: '#2f5ae0', nfc: '#0e7c86', airplane: '#e8702a', notifications: '#d23a3a', sound: '#c9406f',
  display: '#2f5ae0', wallpaper: '#0e8fb0', battery: '#16945a', scanner: '#14a38b', accessibility: '#2f7ad8', security: '#5f6673',
  privacy: '#3a58d0', apps: '#6b55d6', storage: '#7b818c', update: '#5f6673', developer: '#3b3f46', about: '#7b818c',
};

export function SETTINGS_INDEX() {
  const e = (route, title, icon, keywords, path = 'Settings') => ({ route, title, icon, keywords, path, color: ROW_COLORS[route.split('-')[0]] || '#7b818c' });
  const list = [
    e('wifi', 'Wi-Fi', 'wifi', 'wireless network internet wlan'),
    e('bluetooth', 'Bluetooth', 'bluetooth', 'headphones accessories pairing'),
    e('notifications', 'Notifications', 'bell', 'alerts lock screen do not disturb badges'),
    e('sound', 'Sound & Haptics', 'volume', 'volume silent vibration ringtone'),
    e('display', 'Display', 'display', 'brightness dark mode light mode appearance theme auto-lock'),
    e('wallpaper', 'Wallpaper', 'palette', 'background'),
    e('battery', 'Battery', 'battery', 'battery saver power usage charging'),
    e('accessibility', 'Accessibility', 'accessibility', 'text size bold contrast reduce motion'),
    e('security', 'Security', 'shield', 'pin screen lock verified apps security status'),
    e('privacy', 'Privacy', 'hand', 'permissions diagnostics rollout identifier search history'),
    e('apps', 'Apps', 'grid', 'installed ras permissions remove storage'),
    e('storage', 'Storage', 'storage', 'space data'),
    e('update', 'System Update', 'update', 'software update rakenos version check download install'),
    e('update-auto', 'Automatic Updates', 'update', 'download automatically install when ready', 'Settings › System Update'),
    e('update-history', 'Update History', 'history', 'release notes versions', 'Settings › System Update'),
    e('about', 'About RakenOS', 'info', 'version legal licenses ras api'),
  ];
  if (has('nfc')) list.splice(2, 0, e('nfc', 'NFC', 'nfc', 'tags contactless'));
  if (has('scanner2d')) list.splice(8, 0, e('scanner', 'Scanner', 'scanner', 'barcode qr symbologies trigger'));
  if (settings.get('developerEnabled')) list.push(e('developer', 'Developer Options', 'code', 'rollout simulation capabilities debug'));
  return list;
}
