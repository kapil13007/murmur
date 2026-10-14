// File: desktop/main/windows.js
// The two windows: the hub (the React app) and the Flow Bar (the small pill
// at the bottom of the screen that shows recording state).
const path = require('node:path');
const { BrowserWindow, screen, shell } = require('electron');
const { HUB_URL, ROOT } = require('./config');

let hub = null;
let bar = null;
let quitting = false;

function markQuitting() {
  quitting = true;
}

const sameOrigin = (url) => {
  try {
    return new URL(url).origin === new URL(HUB_URL).origin;
  } catch {
    return false;
  }
};

function createHub({ show = true } = {}) {
  if (hub && !hub.isDestroyed()) {
    if (show) showHub();
    return hub;
  }
  hub = new BrowserWindow({
    width: 1350,
    height: 850,
    minWidth: 980,
    minHeight: 640,
    show: false,
    title: 'Whisper Flow',
    backgroundColor: '#faf9f7',
    icon: path.join(ROOT, 'assets', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(ROOT, 'preload', 'hub.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  // Backend down (at launch or on a later reload): show the offline page,
  // which reconnects by itself. -3 is ERR_ABORTED (a superseded navigation).
  hub.webContents.on('did-fail-load', (event, code, description, url, isMainFrame) => {
    if (isMainFrame && code !== -3 && sameOrigin(url)) {
      hub.loadFile(path.join(ROOT, 'renderer', 'offline.html'), { query: { url: HUB_URL } }).catch(() => {});
    }
  });
  hub.loadURL(HUB_URL).catch(() => {});
  hub.once('ready-to-show', () => show && hub.show());

  // Links to other sites open in the default browser, never inside the hub.
  hub.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  hub.webContents.on('will-navigate', (event, url) => {
    if (!sameOrigin(url)) {
      event.preventDefault();
      if (/^https?:/.test(url)) shell.openExternal(url);
    }
  });
  // Closing the hub keeps Flow running in the tray, like Wispr Flow.
  hub.on('close', (event) => {
    if (!quitting) {
      event.preventDefault();
      hub.hide();
    }
  });
  return hub;
}

function showHub(route) {
  const win = createHub({ show: false });
  if (route) win.webContents.executeJavaScript(`window.history.pushState({}, '', ${JSON.stringify(route)}); window.dispatchEvent(new PopStateEvent('popstate'));`).catch(() => {});
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function getHub() {
  return hub && !hub.isDestroyed() ? hub : null;
}

// --- Flow Bar ----------------------------------------------------------------
const BAR_WIDTH = 440;
const BAR_HEIGHT = 150;
let barPosition = 'bottom';

function positionBar() {
  if (!bar || bar.isDestroyed()) return;
  const { workArea } = screen.getPrimaryDisplay();
  bar.setBounds({
    x: Math.round(workArea.x + (workArea.width - BAR_WIDTH) / 2),
    y: barPosition === 'top' ? workArea.y + 6 : Math.round(workArea.y + workArea.height - BAR_HEIGHT - 6),
    width: BAR_WIDTH,
    height: BAR_HEIGHT,
  });
}

// 'bottom' (default) or 'top' of the primary display.
function setBarPosition(position) {
  if (position === barPosition) return;
  barPosition = position === 'top' ? 'top' : 'bottom';
  positionBar();
  getBar()?.webContents.send('bar:position', barPosition);
}

function createFlowBar() {
  bar = new BrowserWindow({
    width: BAR_WIDTH,
    height: BAR_HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    // Never take focus away from the app the user is dictating into.
    focusable: false,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(ROOT, 'preload', 'flowbar.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });
  bar.setAlwaysOnTop(true, 'screen-saver');
  bar.setVisibleOnAllWorkspaces(true);
  // Click-through everywhere except the pill (the renderer toggles this).
  bar.setIgnoreMouseEvents(true, { forward: true });
  bar.loadFile(path.join(ROOT, 'renderer', 'flowbar', 'index.html'));
  positionBar();
  screen.on('display-metrics-changed', positionBar);
  screen.on('display-added', positionBar);
  screen.on('display-removed', positionBar);
  bar.on('close', (event) => {
    if (!quitting) event.preventDefault();
  });
  return bar;
}

function getBar() {
  return bar && !bar.isDestroyed() ? bar : null;
}

module.exports = { createHub, showHub, getHub, createFlowBar, getBar, setBarPosition, markQuitting };
