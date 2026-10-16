// File: desktop/main/index.js
// Electron entry point. Wires the native helper's global shortcuts to the
// dictation controller, keeps the session in step with the hub, and applies
// the user's desktop preferences (Murmur bar, sounds, taskbar, start at login).
const { app, globalShortcut, ipcMain, Notification, session } = require('electron');
const { registerScheme, serveHub } = require('./protocol');

// Before the app is ready: the bundled hub is served from murmur://app.
registerScheme();

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  const config = require('./config');
  const api = require('./api');
  const helper = require('./helper');
  const bar = require('./flowbar');
  const dictation = require('./dictation');
  const windows = require('./windows');
  const { createTray, updateTray } = require('./tray');

  let user = null;
  let prefs = null;
  let captureWaiter = null;
  let fallbackShortcuts = false;

  const fromHub = (event) => event.sender === windows.getHub()?.webContents;
  const fromBar = (event) => event.sender === windows.getBar()?.webContents;
  const sendToHub = (channel, ...args) => windows.getHub()?.webContents.send(channel, ...args);
  const openHub = (route) => windows.showHub(route);

  // --- account -----------------------------------------------------------
  async function loadAccount() {
    if (!api.hasSession()) return signedOut();
    try {
      const [me, preferences] = await Promise.all([api.me(), api.preferences()]);
      user = me.user;
      updateTray({ user });
      applyPreferences(preferences);
      api.registerDevice().catch((err) => console.warn('[flow] device registration failed:', err.message));
    } catch (err) {
      // Offline: keep the stored session and try again shortly.
      if (err.status !== 401) setTimeout(loadAccount, 15_000);
    }
  }

  function signedOut() {
    user = null;
    dictation.cancel({ quiet: true });
    updateTray({ user: null });
    dictation.idle();
  }

  api.onUnauthorized(() => {
    api.setToken(null);
    signedOut();
  });

  // --- preferences -------------------------------------------------------
  function applyPreferences(next) {
    if (!next) return;
    const previous = prefs;
    prefs = next;
    helper.setBindings(prefs.shortcuts);
    if (fallbackShortcuts) registerFallbackShortcuts();
    bar.setVisibleWhenIdle(prefs.show_flow_bar !== false);
    windows.setBarPosition(prefs.flow_bar_position);
    windows.getHub()?.setSkipTaskbar(prefs.show_in_taskbar === false);
    dictation.setPreferences(prefs);
    updateTray({ prefs });
    if (app.isPackaged && previous?.open_at_login !== prefs.open_at_login) {
      // Only the installed app registers itself, never the dev build.
      app.setLoginItemSettings({ openAtLogin: Boolean(prefs.open_at_login), args: ['--hidden'] });
    }
  }

  async function updatePreferences(patch) {
    try {
      applyPreferences(await api.updatePreferences(patch));
    } catch (err) {
      new Notification({ title: 'Murmur', body: `Couldn't save that setting: ${err.message}` }).show();
    }
  }

  // --- shortcuts ---------------------------------------------------------
  helper.on('hotkey', (action, phase) => {
    sendToHub('desktop:hotkey', action, phase);
    dictation.onHotkey(action, phase);
  });
  helper.on('ready', () => updateTray({ helperReady: true }));
  helper.on('capture', (keys, final) => {
    if (!captureWaiter) return;
    if (final) {
      captureWaiter(keys);
      captureWaiter = null;
    } else {
      sendToHub('shortcut:preview', keys);
    }
  });
  helper.on('unavailable', (reason) => {
    console.warn(`[flow] native helper unavailable: ${reason}`);
    updateTray({ helperReady: false });
    fallbackShortcuts = true;
    registerFallbackShortcuts();
  });

  // Without the helper there is no key-up, so only toggle-style shortcuts work.
  const ACCELERATOR_KEYS = { Ctrl: 'Control', Win: 'Super', Esc: 'Escape' };
  const toAccelerator = (keys) => keys.map((k) => ACCELERATOR_KEYS[k] || k).join('+');

  function registerFallbackShortcuts() {
    globalShortcut.unregisterAll();
    const shortcuts = prefs?.shortcuts || {};
    const bind = (keys, action, fallback) => {
      for (const accel of [keys && toAccelerator(keys), fallback].filter(Boolean)) {
        try {
          if (globalShortcut.register(accel, () => dictation.onHotkey(action, 'press'))) return;
        } catch {
          // Not a valid accelerator; try the fallback.
        }
      }
    };
    bind(shortcuts.hands_free, 'hands_free', 'Control+Shift+Space');
    bind(shortcuts.paste_last, 'paste_last');
    bind(shortcuts.copy_last, 'copy_last');
  }

  // --- IPC: hub ------------------------------------------------------------
  ipcMain.on('desktop:config', (event) => {
    event.returnValue = {
      apiBaseUrl: config.API_BASE,
      version: app.getVersion(),
      platform: process.platform,
      nativeShortcuts: helper.available,
    };
  });

  ipcMain.on('session:set', (event, token) => {
    if (!fromHub(event) || typeof token !== 'string' || token.length > 4096) return;
    if (token === api.getToken()) return;
    api.setToken(token);
    loadAccount();
  });

  ipcMain.on('session:clear', (event) => {
    if (!fromHub(event)) return;
    api.setToken(null);
    signedOut();
  });

  ipcMain.on('prefs:changed', (event, next) => {
    if (fromHub(event) && next && typeof next === 'object') applyPreferences(next);
  });

  ipcMain.handle('shortcut:capture', (event) => {
    if (!fromHub(event) || !helper.ready) return null;
    captureWaiter?.(null);
    helper.startCapture();
    return new Promise((resolve) => {
      captureWaiter = resolve;
      setTimeout(() => {
        if (captureWaiter === resolve) {
          helper.stopCapture();
          captureWaiter = null;
          resolve(null);
        }
      }, 20_000);
    });
  });

  ipcMain.on('shortcut:capture-cancel', (event) => {
    if (!fromHub(event) || !captureWaiter) return;
    helper.stopCapture();
    captureWaiter(null);
    captureWaiter = null;
  });

  // --- IPC: Murmur bar -------------------------------------------------------
  ipcMain.on('bar:action', (event, action) => {
    if (!fromBar(event)) return;
    if (action === 'start') dictation.onHotkey('hands_free', 'press');
    else if (action === 'stop') dictation.finish();
    else if (action === 'cancel') dictation.cancel();
    else if (action === 'open-hub') openHub();
  });

  // --- startup -------------------------------------------------------------
  app.on('second-instance', () => openHub());
  app.on('window-all-closed', () => {
    // Stay alive in the tray.
  });
  app.on('before-quit', () => windows.markQuitting());
  app.on('will-quit', () => globalShortcut.unregisterAll());

  app.whenReady().then(() => {
    app.setAppUserModelId('com.prem.murmur');
    if (config.hasBundledHub) serveHub();

    // Microphone for the Murmur bar recorder (file://) and the hub's in-page
    // dictation; clipboard writes for the hub's copy buttons. Nothing else.
    const trusted = (url) => url.startsWith('file://') || config.originOf(url) === config.HUB_ORIGIN;
    const ALLOWED = new Set(['media', 'clipboard-sanitized-write']);
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
      const mediaOk = permission !== 'media' || (details.mediaTypes || []).every((t) => t === 'audio');
      callback(ALLOWED.has(permission) && mediaOk && trusted(details.requestingUrl || webContents.getURL()));
    });
    session.defaultSession.setPermissionCheckHandler((webContents, permission, origin) =>
      ALLOWED.has(permission) && trusted(origin || webContents?.getURL() || ''),
    );

    windows.createFlowBar();
    windows.createHub({ show: !config.startHidden });
    createTray({
      openHub,
      pasteLast: () => dictation.pasteLast(),
      updatePreferences,
      quit: () => app.quit(),
    });
    dictation.showHub = (route) => openHub(route);

    let recording = false;
    bar.onStateChange(() => {
      const now = dictation.state !== 'idle';
      if (now === recording) return;
      recording = now;
      updateTray({ recording });
      // Without the helper, Esc is only grabbed while Murmur is listening.
      if (fallbackShortcuts && recording) globalShortcut.register('Escape', () => dictation.cancel());
      else if (fallbackShortcuts) globalShortcut.unregister('Escape');
    });
    dictation.idle();

    helper.start();
    loadAccount();
  });
}
