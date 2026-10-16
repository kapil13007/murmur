// File: desktop/main/tray.js
// Notification-area icon: Murmur keeps running here when the hub is closed.
const path = require('node:path');
const { Menu, Tray, app, nativeImage } = require('electron');
const { ROOT } = require('./config');

let tray = null;
let actions = {};
let status = { user: null, prefs: null, recording: false, helperReady: true, update: { status: 'idle' } };

const icon = (name) => nativeImage.createFromPath(path.join(ROOT, 'assets', name));
const comboLabel = (keys) => (keys && keys.length ? keys.join(' + ') : 'not set');

// What the tray says about updates: a restart button once one is downloaded.
function updateItems(update) {
  if (update.status === 'ready') {
    return [{ label: `Restart to update to ${update.version}`, click: () => actions.installUpdate() }];
  }
  if (update.status === 'downloading') {
    return [{ label: `Downloading update ${update.version || ''} (${update.percent || 0}%)`, enabled: false }];
  }
  if (update.status === 'checking') return [{ label: 'Checking for updates…', enabled: false }];
  return [{ label: 'Check for updates', click: () => actions.checkForUpdates() }];
}

function buildMenu() {
  const { user, prefs, helperReady, update } = status;
  const shortcuts = prefs?.shortcuts || {};
  return Menu.buildFromTemplate([
    { label: user ? `Signed in as ${user.email}` : 'Not signed in', enabled: false },
    ...(helperReady ? [] : [{ label: 'Global shortcuts unavailable', enabled: false }]),
    { type: 'separator' },
    { label: 'Open Murmur', click: () => actions.openHub() },
    {
      label: `Paste last transcript  (${comboLabel(shortcuts.paste_last)})`,
      enabled: Boolean(user),
      click: () => actions.pasteLast(),
    },
    { type: 'separator' },
    {
      label: 'Show the Murmur bar',
      type: 'checkbox',
      checked: prefs?.show_flow_bar !== false,
      enabled: Boolean(prefs),
      click: (item) => actions.updatePreferences({ show_flow_bar: item.checked }),
    },
    {
      label: 'Sound effects',
      type: 'checkbox',
      checked: prefs?.enable_sounds !== false,
      enabled: Boolean(prefs),
      click: (item) => actions.updatePreferences({ enable_sounds: item.checked }),
    },
    { label: 'Settings…', click: () => actions.openHub('/settings') },
    { type: 'separator' },
    ...updateItems(update),
    { label: `Murmur ${app.getVersion()}`, enabled: false },
    { label: 'Quit Murmur', click: () => actions.quit() },
  ]);
}

function refresh() {
  if (!tray) return;
  tray.setContextMenu(buildMenu());
  const keys = comboLabel(status.prefs?.shortcuts?.push_to_talk);
  tray.setToolTip(status.recording ? 'Murmur - listening…' : `Murmur - hold ${keys} to dictate`);
  tray.setImage(icon(status.recording ? 'tray-recording.png' : 'tray.png'));
}

// handlers: { openHub(route?), pasteLast(), updatePreferences(patch), checkForUpdates(), installUpdate(), quit() }
function createTray(handlers) {
  actions = handlers;
  tray = new Tray(icon('tray.png'));
  tray.on('click', () => actions.openHub());
  refresh();
  return tray;
}

function updateTray(patch) {
  status = { ...status, ...patch };
  refresh();
}

function destroyTray() {
  tray?.destroy();
  tray = null;
}

module.exports = { createTray, updateTray, destroyTray };
