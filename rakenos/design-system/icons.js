/*
 * Raken Design System — icon set
 * 24 × 24 grid, 1.8 px stroke, round caps and joins. Every icon uses
 * currentColor, so it follows the surrounding text colour.
 * Filled glyphs (`fill: true`) are used for app icons and active states.
 */

const P = {
  // Navigation
  'chevron-right': '<path d="M9.5 6l6 6-6 6"/>',
  'chevron-left': '<path d="M14.5 6l-6 6 6 6"/>',
  'chevron-down': '<path d="M6 9.5l6 6 6-6"/>',
  'chevron-up': '<path d="M6 14.5l6-6 6 6"/>',
  'arrow-left': '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
  'arrow-up': '<path d="M12 19V5M6 11l6-6 6 6"/>',
  'arrow-down': '<path d="M12 5v14M6 13l6 6 6-6"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  more: '<circle cx="5.5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.3" fill="currentColor" stroke="none"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.3"/><path d="M15.5 15.5L20 20"/>',
  home: '<path d="M4 10.5L12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>',
  widgets: '<rect x="4" y="4" width="16" height="7" rx="2"/><rect x="4" y="13.5" width="7" height="6.5" rx="2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="2"/>',
  recents: '<rect x="7" y="4" width="10" height="16" rx="2"/><path d="M4 7v10M20 7v10"/>',
  refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4h-4"/>',
  external: '<path d="M14 5h5v5M19 5l-8 8"/><path d="M17 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h4"/>',

  // Connectivity & controls
  wifi: '<path d="M3.5 9.2a12.5 12.5 0 0 1 17 0"/><path d="M6.4 12.3a8.2 8.2 0 0 1 11.2 0"/><path d="M9.3 15.4a4 4 0 0 1 5.4 0"/><circle cx="12" cy="18.6" r="1.1" fill="currentColor" stroke="none"/>',
  'wifi-off': '<path d="M3.5 9.2a12.5 12.5 0 0 1 4-2.6M20.5 9.2a12.5 12.5 0 0 0-8.9-3.4M6.4 12.3a8.2 8.2 0 0 1 3.2-1.8M17.6 12.3a8 8 0 0 0-1.9-1.3M9.3 15.4a4 4 0 0 1 5.4 0"/><path d="M4 4l16 16"/>',
  bluetooth: '<path d="M7 7.5l10 9-5 4v-17l5 4-10 9"/>',
  airplane: '<path d="M12 3.5c.9 0 1.4 1 1.4 2.3v4.1l6.6 4v1.8l-6.6-2v3.6l2 1.6v1.6L12 19.5l-3.4 1v-1.6l2-1.6v-3.6l-6.6 2v-1.8l6.6-4V5.8c0-1.3.5-2.3 1.4-2.3z"/>',
  moon: '<path d="M19.5 14.2A7.8 7.8 0 1 1 9.8 4.5a6.3 6.3 0 0 0 9.7 9.7z"/>',
  sun: '<circle cx="12" cy="12" r="3.8"/><path d="M12 3v1.8M12 19.2V21M3 12h1.8M19.2 12H21M5.6 5.6l1.3 1.3M17.1 17.1l1.3 1.3M5.6 18.4l1.3-1.3M17.1 6.9l1.3-1.3"/>',
  'sun-dim': '<circle cx="12" cy="12" r="3.6"/><path d="M12 5.5v.5M12 18v.5M5.5 12h.5M18 12h.5M7.4 7.4l.3.3M16.3 16.3l.3.3M7.4 16.6l.3-.3M16.3 7.7l.3-.3"/>',
  flashlight: '<path d="M8 3.5h8v3.2l-2 3.3V20a.9.9 0 0 1-.9.9h-2.2A.9.9 0 0 1 10 20V10L8 6.7z"/><path d="M8 6.7h8"/><circle cx="12" cy="13.6" r="1" fill="currentColor" stroke="none"/>',
  nfc: '<path d="M6.5 7.2a6.8 6.8 0 0 0 0 9.6"/><path d="M9.3 9.4a3.7 3.7 0 0 0 0 5.2"/><path d="M13 4.4c4.3 4.1 4.3 11.1 0 15.2"/><path d="M16.2 6.2c3.2 3.2 3.2 8.4 0 11.6"/>',
  scanner: '<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><path d="M7.5 8v8M10 8v8M12.5 8v8M16.5 8v8M14.5 8v8" stroke-width="1.5"/>',
  qr: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2.5v2.5H14zM17.5 17.5H20V20h-2.5zM14 18.5v1.5M20 14v1.5"/>',
  'rotation-lock': '<rect x="8.5" y="7" width="7" height="10" rx="1.3"/><path d="M4.6 9.5A8 8 0 0 1 16 4.3M19.4 14.5A8 8 0 0 1 8 19.7"/><path d="M16 4.3l-.6 2.3M8 19.7l.6-2.3"/>',
  contrast: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>',
  leaf: '<path d="M5 19c0-8 4.5-13.5 14-14-0.3 9.3-5.8 14-13 14z"/><path d="M5 19c3-4 6-6.5 9.5-8"/>',
  bell: '<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.7H5z"/><path d="M10 20.3a2.2 2.2 0 0 0 4 0"/>',
  'bell-off': '<path d="M8.2 6.9A5.5 5.5 0 0 1 17.5 11v4M6.5 11v5.5L5 18.2h11"/><path d="M10 20.3a2.2 2.2 0 0 0 4 0M4 4l16 16"/>',
  volume: '<path d="M4.5 9.5h3l4.5-4v13l-4.5-4h-3z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11"/>',
  'volume-low': '<path d="M4.5 9.5h3l4.5-4v13l-4.5-4h-3z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6"/>',
  'volume-off': '<path d="M4.5 9.5h3l4.5-4v13l-4.5-4h-3z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
  vibrate: '<rect x="8" y="4" width="8" height="16" rx="1.8"/><path d="M4.5 8.5v7M19.5 8.5v7M2 10.5v3M22 10.5v3"/>',
  speaker: '<rect x="6" y="3.5" width="12" height="17" rx="2.2"/><circle cx="12" cy="14.3" r="3"/><circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none"/>',
  display: '<rect x="3.5" y="4.5" width="17" height="12" rx="1.8"/><path d="M9 20h6M12 16.5V20"/>',
  'text-size': '<path d="M3.5 18L8 7l4.5 11M5.2 14h5.6"/><path d="M13.5 18l3.5-8 3.5 8M14.6 15.5h4.8"/>',
  palette: '<path d="M12 3.8a8.2 8.2 0 1 0 0 16.4c1 0 1.6-.7 1.6-1.5 0-.9-.8-1.3-.8-2.1 0-.9.7-1.5 1.6-1.5h2a3.8 3.8 0 0 0 3.8-3.8c0-4.1-3.7-7.5-8.2-7.5z"/><circle cx="7.8" cy="11.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="10.5" cy="7.6" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="8" r="1.1" fill="currentColor" stroke="none"/>',

  // Security & privacy
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7"/>',
  unlock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.8a4 4 0 0 1 7.7-1.5"/>',
  shield: '<path d="M12 3.5l7 2.8v5.4c0 4.4-3 7.6-7 8.8-4-1.2-7-4.4-7-8.8V6.3z"/>',
  'shield-check': '<path d="M12 3.5l7 2.8v5.4c0 4.4-3 7.6-7 8.8-4-1.2-7-4.4-7-8.8V6.3z"/><path d="M8.7 12.2l2.3 2.3 4.4-4.6"/>',
  hand: '<path d="M8 12.5V6.8a1.4 1.4 0 0 1 2.8 0v4.7M10.8 11V5.4a1.4 1.4 0 0 1 2.8 0V11M13.6 11V6.4a1.4 1.4 0 0 1 2.8 0v6.1M16.4 10.2a1.4 1.4 0 0 1 2.8 0V14a6.5 6.5 0 0 1-6.5 6.5h-.6a6 6 0 0 1-4.7-2.3l-3-3.9a1.4 1.4 0 0 1 2.1-1.8L8 14"/>',
  'eye-off': '<path d="M9.9 5.7A9.6 9.6 0 0 1 12 5.5c5 0 8.3 4.5 9 6.5-.4 1-1.3 2.4-2.6 3.7M6.3 7.3C4.5 8.6 3.4 10.6 3 12c.7 2 4 6.5 9 6.5 1.4 0 2.7-.4 3.8-.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M4 4l16 16"/>',
  eye: '<path d="M3 12c.7-2 4-6.5 9-6.5s8.3 4.5 9 6.5c-.7 2-4 6.5-9 6.5S3.7 14 3 12z"/><circle cx="12" cy="12" r="3"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l2.5 2.5M14 9l2 2"/>',
  location: '<path d="M12 20.5s6.5-6 6.5-11a6.5 6.5 0 0 0-13 0c0 5 6.5 11 6.5 11z"/><circle cx="12" cy="9.5" r="2.4"/>',
  mic: '<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.8 11.5a6.2 6.2 0 0 0 12.4 0M12 17.8v2.7"/>',
  fingerprint: '<path d="M7 18.5c1-1.6 1.5-3.8 1.5-6a3.5 3.5 0 0 1 7 0c0 2.6-.3 4.9-1.2 7"/><path d="M4.5 14.5c.4-1 .5-2 .5-3a7 7 0 0 1 12.2-4.7M19 11.5c0 3-.3 5.2-.9 7"/><path d="M12 12.5c0 3.2-.7 5.7-2 8"/>',

  // System
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.5-2-3.4-2.3 1a7.4 7.4 0 0 0-2.6-1.5L14.2 2.6h-4l-.3 2.5a7.4 7.4 0 0 0-2.6 1.5l-2.3-1-2 3.4 2 1.5a7.6 7.6 0 0 0 0 3l-2 1.5 2 3.4 2.3-1a7.4 7.4 0 0 0 2.6 1.5l.3 2.5h4l.3-2.5a7.4 7.4 0 0 0 2.6-1.5l2.3 1 2-3.4z"/>',
  update: '<path d="M4.5 12a7.5 7.5 0 0 1 13-5.1M19.5 12a7.5 7.5 0 0 1-13 5.1"/><path d="M17.8 3.8v3.4h-3.4M6.2 20.2v-3.4h3.4"/><path d="M12 8.5v4l2.5 1.5"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5"/><path d="M5 19.5h14"/>',
  upload: '<path d="M12 16V5M7 9.5l5-5 5 5"/><path d="M5 19.5h14"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r="1.1" fill="currentColor" stroke="none"/>',
  alert: '<path d="M12 4l9 15.5H3z"/><path d="M12 10v4.5"/><circle cx="12" cy="17.1" r="1" fill="currentColor" stroke="none"/>',
  code: '<path d="M8.5 7L3.5 12l5 5M15.5 7l5 5-5 5M13.5 5l-3 14"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"/>',
  storage: '<ellipse cx="12" cy="6.5" rx="7" ry="2.8"/><path d="M5 6.5v11c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-11M5 12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8"/>',
  package: '<path d="M12 3.5l8 4.2v8.6l-8 4.2-8-4.2V7.7z"/><path d="M4 7.7l8 4.3 8-4.3M12 12v8.5M8 5.6l8 4.3"/>',
  sparkle: '<path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8z"/><path d="M18.5 16l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
  power: '<path d="M12 3.5v8"/><path d="M7.2 6.4a7.5 7.5 0 1 0 9.6 0"/>',
  restart: '<path d="M5 12a7 7 0 1 0 2.1-5"/><path d="M5 4v4.5h4.5"/>',
  person: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c.8-3.7 3.8-6 7.5-6s6.7 2.3 7.5 6"/>',
  devices: '<rect x="3" y="5" width="12" height="9" rx="1.5"/><path d="M6 17.5h6"/><rect x="16.5" y="8" width="5" height="11.5" rx="1.3"/>',
  battery: '<rect x="2.5" y="7.5" width="17" height="9" rx="2.2"/><path d="M21.5 10.5v3"/>',
  'battery-charging': '<rect x="2.5" y="7.5" width="17" height="9" rx="2.2"/><path d="M21.5 10.5v3M11.5 9l-2.5 3.5h4L10.5 15"/>',
  bolt: '<path d="M13 3L5.5 13.5H11L10 21l7.5-10.5H12z"/>',
  gauge: '<path d="M4.3 17a8.5 8.5 0 1 1 15.4 0"/><path d="M12 13.5l3.5-4.5"/><circle cx="12" cy="13.5" r="1.3" fill="currentColor" stroke="none"/>',
  history: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v3.5H8"/><path d="M12 8v4.3l3 1.7"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.3 2.4 3.5 5.2 3.5 8.5s-1.2 6.1-3.5 8.5c-2.3-2.4-3.5-5.2-3.5-8.5S9.7 5.9 12 3.5z"/>',
  accessibility: '<circle cx="12" cy="4.8" r="1.6"/><path d="M5 8.5c2.3.7 4.6 1 7 1s4.7-.3 7-1M12 9.5v4.5M12 14l-3 6.5M12 14l3 6.5"/>',
  translate: '<path d="M4 6h9M8.5 4v2M11 6c-.7 3.8-3 6.6-6.5 8M6.5 9c1 2.2 2.7 3.9 5 5"/><path d="M13 20l4-9 4 9M14.3 17.2h5.4"/>',

  // Apps
  camera: '<path d="M4 8.5a1.5 1.5 0 0 1 1.5-1.5h2.3l1.5-2.2h5.4L16.2 7h2.3A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="12.7" r="3.5"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.2"/><circle cx="9" cy="9.5" r="1.7"/><path d="M3.5 17l4.8-4.8a1.3 1.3 0 0 1 1.8 0L14 16l2-2a1.3 1.3 0 0 1 1.8 0l2.7 2.7"/>',
  folder: '<path d="M3.5 7.2A1.7 1.7 0 0 1 5.2 5.5h4.1l2 2.2h7.5a1.7 1.7 0 0 1 1.7 1.7v8.4a1.7 1.7 0 0 1-1.7 1.7H5.2a1.7 1.7 0 0 1-1.7-1.7z"/>',
  file: '<path d="M6.5 3.5h7l4.5 4.5v11a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5z"/><path d="M13.5 3.5V8H18"/>',
  'file-text': '<path d="M6.5 3.5h7l4.5 4.5v11a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5z"/><path d="M13.5 3.5V8H18M8.5 12.5h7M8.5 16h5"/>',
  archive: '<rect x="3.5" y="4.5" width="17" height="4.5" rx="1.2"/><path d="M5 9v9a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 18V9M10 12.5h4"/>',
  note: '<path d="M6 3.5h12A1.5 1.5 0 0 1 19.5 5v10.5l-5 5H6A1.5 1.5 0 0 1 4.5 19V5A1.5 1.5 0 0 1 6 3.5z"/><path d="M19.5 15.5h-3.5a1.5 1.5 0 0 0-1.5 1.5v3.5M8 8.5h8M8 12h6"/>',
  pencil: '<path d="M15.2 5.3l3.5 3.5L8.5 19H5v-3.5z"/><path d="M13 7.5l3.5 3.5"/>',
  calculator: '<rect x="5" y="3.5" width="14" height="17" rx="2.2"/><rect x="8" y="6.5" width="8" height="3.5" rx="0.8"/><circle cx="8.8" cy="13.5" r="0.9" fill="currentColor" stroke="none"/><circle cx="12" cy="13.5" r="0.9" fill="currentColor" stroke="none"/><circle cx="15.2" cy="13.5" r="0.9" fill="currentColor" stroke="none"/><circle cx="8.8" cy="17" r="0.9" fill="currentColor" stroke="none"/><circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none"/><circle cx="15.2" cy="17" r="0.9" fill="currentColor" stroke="none"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.2l3.3 2"/>',
  alarm: '<circle cx="12" cy="13" r="7"/><path d="M12 9.5V13l2.3 1.5M4.5 6.5l3-2.5M19.5 6.5l-3-2.5"/>',
  stopwatch: '<circle cx="12" cy="13.5" r="7"/><path d="M12 13.5V10M10 3.5h4M18.3 7.2l1.2-1.2"/>',
  timer: '<path d="M12 4.5a8.5 8.5 0 1 1-6 2.5"/><path d="M12 4.5V8M12 13l-4-4"/>',
  compass: '<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  bag: '<path d="M5.5 8h13l-1 11.2a1.5 1.5 0 0 1-1.5 1.3H8a1.5 1.5 0 0 1-1.5-1.3z"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/>',
  star: '<path d="M12 4l2.4 5 5.4.7-4 3.7 1 5.4L12 16.2l-4.8 2.6 1-5.4-4-3.7 5.4-.7z"/>',
  heart: '<path d="M12 19.5s-7.5-4.4-7.5-10A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7.5 2.5c0 5.6-7.5 10-7.5 10z"/>',
  trash: '<path d="M4.5 7h15M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2M6.5 7l.9 11.6a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4L17.5 7"/>',
  share: '<path d="M12 14.5V4M8 7.5l4-4 4 4"/><path d="M8 10.5H6.5A1.5 1.5 0 0 0 5 12v7a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-7a1.5 1.5 0 0 0-1.5-1.5H16"/>',
  bookmark: '<path d="M6.5 4.5A1 1 0 0 1 7.5 3.5h9a1 1 0 0 1 1 1v16L12 16.5 6.5 20.5z"/>',
  tabs: '<rect x="4" y="7" width="13" height="13" rx="2"/><path d="M8 4h10a2 2 0 0 1 2 2v10"/>',
  reload: '<path d="M18.5 9A7 7 0 1 0 19 13"/><path d="M19 4.5V9h-4.5"/>',
  flash: '<path d="M13 3L5.5 13.5H11L10 21l7.5-10.5H12z"/>',
  'flash-off': '<path d="M9.5 6.5L13 3l-1 7.5h5.5l-1.8 2.5M11.5 16.5L10 21l3.2-4.5M5.5 13.5H11M4 4l16 16"/>',
  'camera-switch': '<path d="M4 8.5a1.5 1.5 0 0 1 1.5-1.5h2.3l1.5-2.2h5.4L16.2 7h2.3A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5z"/><path d="M8.8 12a3.2 3.2 0 0 1 5.6-2M15.2 13.5a3.2 3.2 0 0 1-5.6 2"/><path d="M14.6 8.4v1.8h-1.8M9.4 17v-1.8h1.8"/>',
  aperture: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5l4.2 7.3M20.2 9.8l-8.4.1M17.9 18l-4.2-7.3M12 20.5l-4.2-7.3M3.8 14.2l8.4-.1M6.1 6l4.2 7.3"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  pause: '<path d="M8.5 5.5v13M15.5 5.5v13"/>',
  flag: '<path d="M5.5 20.5V4M5.5 4.5h10.5l-2 4 2 4H5.5"/>',
  counter: '<rect x="4" y="5" width="16" height="14" rx="3"/><path d="M9 9.5v5M6.5 12h5M14.5 12h3"/>',
  checklist: '<path d="M4.5 7l1.7 1.7L9.5 5.4M4.5 13l1.7 1.7 3.3-3.3M4.5 19l1.7 1.7 3.3-3.3"/><path d="M12.5 7h7M12.5 13h7M12.5 19h7"/>',
  split: '<path d="M4.5 19.5h15M6.5 16.5V9M10.5 16.5V9M13.5 16.5V9M17.5 16.5V9M3.5 9L12 4l8.5 5z"/>',
  ruler: '<rect x="2.8" y="8" width="18.4" height="8" rx="1.5" transform="rotate(-30 12 12)"/><path d="M8.2 9.6l1 1.7M11 8l1.7 2.9M13.8 6.4l1 1.7"/>',
  leafy: '<path d="M12 20.5v-7M12 13.5c-4.5 0-7-2.8-7-7 4.5 0 7 2.8 7 7zM12 13.5c0-4.2 2.5-7 7-7 0 4.2-2.5 7-7 7z"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
  suitcase: '<rect x="4" y="7.5" width="16" height="12" rx="2"/><path d="M9 7.5V5.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M4 12.5h16"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" stroke="none"/><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="15.5" cy="8.5" r="1.2" fill="currentColor" stroke="none"/><circle cx="8.5" cy="15.5" r="1.2" fill="currentColor" stroke="none"/>',
  water: '<path d="M12 3.5s6 6.3 6 10.5a6 6 0 0 1-12 0c0-4.2 6-10.5 6-10.5z"/>',
};

export function icon(name, opts = {}) {
  const body = P[name] || P.info;
  const size = opts.size ? ` style="font-size:${opts.size}px"` : '';
  const cls = opts.className ? ` ${opts.className}` : '';
  const sw = opts.strokeWidth || 1.8;
  const label = opts.label ? ` role="img" aria-label="${opts.label}"` : ' aria-hidden="true"';
  return `<svg class="r-icon${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"${size}${label}>${body}</svg>`;
}

export function hasIcon(name) { return Object.prototype.hasOwnProperty.call(P, name); }
export const iconNames = Object.keys(P);

/* Battery glyph with a live fill level (0–100). */
export function batteryIcon(level, charging, opts = {}) {
  const w = Math.max(1.5, Math.round((Math.min(100, Math.max(0, level)) / 100) * 13 * 10) / 10);
  const low = level <= 20 && !charging;
  const fill = low ? 'var(--r-danger)' : 'currentColor';
  const bolt = charging ? '<path d="M11.8 8.6l-2.6 3.7h3.1l-1 3.1" stroke="var(--r-bg, #000)" stroke-width="1.4" fill="none"/>' : '';
  return `<svg class="r-icon ${opts.className || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="7.5" width="17" height="9" rx="2.4" opacity="0.55"/><path d="M21.5 10.5v3" opacity="0.55"/><rect x="4.5" y="9.5" width="${w}" height="5" rx="1" fill="${fill}" stroke="none"/>${bolt}</svg>`;
}
