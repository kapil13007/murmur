// File: desktop/main/config.js
// Where the desktop app finds the backend and the hub UI.
//   API_URL  - Express backend origin. Order: the API_URL environment variable,
//              then "apiUrl" in murmur.config.json (what the installer ships
//              with), then http://localhost:8000.
//   HUB_URL  - hub UI address. Order: the HUB_URL environment variable (the
//              Vite dev server), then the bundled hub (desktop/hub, served as
//              murmur://app), then the backend itself (SERVE_FRONTEND=true).
const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

const ROOT = path.resolve(__dirname, '..');

function fileConfig() {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'murmur.config.json'), 'utf8'));
  } catch {
    return {};
  }
}

const HUB_SCHEME = 'murmur';
// Packaged: electron-builder copies desktop/hub next to the app (extraResources).
const HUB_DIR = app.isPackaged ? path.join(process.resourcesPath, 'hub') : path.join(ROOT, 'hub');
const hasBundledHub = fs.existsSync(path.join(HUB_DIR, 'index.html'));

const API_ORIGIN = (process.env.API_URL || fileConfig().apiUrl || 'http://localhost:8000').replace(/\/$/, '');
const HUB_URL = (process.env.HUB_URL || (hasBundledHub ? `${HUB_SCHEME}://app` : API_ORIGIN)).replace(/\/$/, '');

// protocol + host: URL.origin is "null" for custom schemes.
const originOf = (url) => {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
};

module.exports = {
  API_ORIGIN,
  API_BASE: `${API_ORIGIN}/api/v1`,
  HUB_URL,
  HUB_ORIGIN: originOf(HUB_URL),
  HUB_DIR,
  HUB_SCHEME,
  hasBundledHub,
  originOf,
  ROOT,
  isDev: !app.isPackaged,
  startHidden: process.argv.includes('--hidden'),
  // Longest single dictation, like Wispr Flow's ~6 minute cap.
  MAX_RECORDING_MS: 6 * 60 * 1000,
  // Shorter presses are treated as accidental taps.
  MIN_RECORDING_MS: 350,
  // How long the target app gets to read a paste before the clipboard is restored.
  PASTE_RESTORE_DELAY_MS: 600,
};
