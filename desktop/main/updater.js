// File: desktop/main/updater.js
// Keeps the installed app current. Murmur checks the GitHub releases of this
// project on start-up and every few hours, downloads a newer installer in the
// background, and installs it the next time the app quits, or right away when
// the user chooses "Restart to update" in the tray.
const { app } = require('electron');
const { autoUpdater } = require('electron-updater');

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
const FIRST_CHECK_MS = 20 * 1000;

const REPO = { provider: 'github', owner: 'kapil13007', repo: 'murmur' };

// state: idle | checking | downloading | ready | error
let state = { status: 'idle', version: null, percent: 0, message: '' };
let listener = () => {};
let timer = null;

function set(next) {
  state = { ...state, ...next };
  listener(state);
}

function wire() {
  autoUpdater.autoDownload = true;
  // If the user never clicks "Restart to update", it installs when Murmur quits.
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = {
    info: (m) => console.log('[updater]', m),
    warn: (m) => console.warn('[updater]', m),
    error: (m) => console.error('[updater]', m),
    debug: () => {},
  };
  autoUpdater.on('checking-for-update', () => set({ status: 'checking', message: '' }));
  autoUpdater.on('update-available', (info) => set({ status: 'downloading', version: info.version, percent: 0 }));
  autoUpdater.on('update-not-available', () => set({ status: 'idle', version: null }));
  autoUpdater.on('download-progress', (p) => set({ status: 'downloading', percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (info) => set({ status: 'ready', version: info.version, percent: 100 }));
  autoUpdater.on('error', (err) => set({ status: 'error', message: err?.message || 'Update check failed' }));
}

// onChange(state) is called whenever the update state changes.
function initUpdater(onChange, { force = false } = {}) {
  listener = onChange;
  // Development runs have no installed version to replace.
  if (!app.isPackaged && !force) return;
  autoUpdater.setFeedURL(REPO);
  wire();
  setTimeout(() => checkForUpdates(), FIRST_CHECK_MS).unref();
  timer = setInterval(() => checkForUpdates(), CHECK_EVERY_MS);
  timer.unref();
}

function checkForUpdates() {
  // Checking while a download is running or finished would restart it.
  if (state.status === 'checking' || state.status === 'downloading' || state.status === 'ready') return Promise.resolve(null);
  return autoUpdater.checkForUpdates().catch((err) => set({ status: 'error', message: err?.message || 'Update check failed' }));
}

// Silent install, then relaunch (the installer is per-user, so no admin prompt).
function installUpdate() {
  if (state.status === 'ready') autoUpdater.quitAndInstall(true, true);
}

module.exports = { initUpdater, checkForUpdates, installUpdate, getUpdateState: () => state, autoUpdater };
