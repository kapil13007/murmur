// File: desktop/main/config.js
// Where the desktop app finds the backend and the hub UI.
//   API_URL  - Express backend origin (default http://localhost:8000)
//   HUB_URL  - hub UI origin: Vite dev server in development, otherwise the
//              backend, which serves the built frontend (SERVE_FRONTEND=true)
const path = require('node:path');
const { app } = require('electron');

const API_ORIGIN = (process.env.API_URL || 'http://localhost:8000').replace(/\/$/, '');
const HUB_URL = (process.env.HUB_URL || API_ORIGIN).replace(/\/$/, '');

module.exports = {
  API_ORIGIN,
  API_BASE: `${API_ORIGIN}/api/v1`,
  HUB_URL,
  ROOT: path.resolve(__dirname, '..'),
  isDev: !app.isPackaged,
  startHidden: process.argv.includes('--hidden'),
  // Longest single dictation, like Wispr Flow's ~6 minute cap.
  MAX_RECORDING_MS: 6 * 60 * 1000,
  // Shorter presses are treated as accidental taps.
  MIN_RECORDING_MS: 350,
  // How long the target app gets to read a paste before the clipboard is restored.
  PASTE_RESTORE_DELAY_MS: 600,
};
