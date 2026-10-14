// File: desktop/preload/hub.js
// Exposes `window.flowDesktop` to the hub (see frontend/src/desktop/bridge.js).
// The hub stays an ordinary web app; this is its only door into the desktop.
const { contextBridge, ipcRenderer } = require('electron');

const config = ipcRenderer.sendSync('desktop:config');

function listen(channel, callback) {
  const handler = (_event, ...args) => callback(...args);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

const shortcutCapture = config.nativeShortcuts
  ? {
      // Resolves to the combo the user pressed (e.g. ['Ctrl', 'Win']) or null.
      captureShortcut: () => ipcRenderer.invoke('shortcut:capture'),
      cancelShortcutCapture: () => ipcRenderer.send('shortcut:capture-cancel'),
      onShortcutPreview: (callback) => listen('shortcut:preview', callback),
    }
  : {};

contextBridge.exposeInMainWorld('flowDesktop', {
  apiBaseUrl: config.apiBaseUrl,
  version: config.version,
  platform: config.platform,
  setSession: (token) => ipcRenderer.send('session:set', token),
  clearSession: () => ipcRenderer.send('session:clear'),
  preferencesChanged: (preferences) => ipcRenderer.send('prefs:changed', preferences),
  // callback(action, phase), e.g. ('push_to_talk', 'down').
  onHotkey: (callback) => listen('desktop:hotkey', callback),
  ...shortcutCapture,
});
