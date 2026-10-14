// File: desktop/scripts/capture-screens.js
// Dev tool: renders every hub screen in a hidden Electron window and saves
// PNGs (used for the README and for visual checks). Requires the backend to
// serve the built frontend (SERVE_FRONTEND=true) and the demo seed data.
//
//   npx electron scripts/capture-screens.js [--out=dir] [--theme=dark]
const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const HUB = process.env.HUB_URL || 'http://localhost:8000';
const API = `${process.env.API_URL || 'http://localhost:8000'}/api/v1`;
const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] || fallback;
const OUT = path.resolve(arg('out', path.join(__dirname, '..', '..', 'docs', 'screenshots')));
const THEME = arg('theme', 'light');
const EMAIL = process.env.DEMO_EMAIL || 'demo@whisperflow.local';
const PASSWORD = process.env.DEMO_PASSWORD || 'Demo12345';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(pathname, token, options = {}) {
  const res = await fetch(`${API}${pathname}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  if (!res.ok) throw new Error(`${pathname} -> ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

async function shoot(win, name) {
  const image = await win.webContents.capturePage();
  fs.writeFileSync(path.join(OUT, `${name}${THEME === 'dark' ? '-dark' : ''}.png`), image.toPNG());
  console.log(`saved ${name}`);
}

app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { access_token: token } = await api('/auth/login', null, {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, remember_me: true }),
  });
  const prefs = await api('/preferences', token);
  if (prefs.theme !== THEME) await api('/preferences', token, { method: 'PATCH', body: JSON.stringify({ theme: THEME }) });
  const notes = await api('/notes', token);

  // Offscreen rendering keeps painting frames without showing a window, so
  // capturePage() always gets the current UI (a hidden window would not repaint).
  const win = new BrowserWindow({ width: 1350, height: 850, show: false, webPreferences: { offscreen: true, backgroundThrottling: false } });
  win.webContents.setFrameRate(30);
  const settled = () =>
    win.webContents.executeJavaScript(`!document.querySelector('[role="status"]') && document.getElementById('root').children.length > 0`);
  const visit = async (route, wait = 700) => {
    await win.loadURL(`${HUB}${route}`);
    for (let i = 0; i < 40 && !(await settled()); i++) await sleep(150);
    await sleep(wait);
  };

  await visit('/login', 800);
  await shoot(win, '01-login');
  await win.webContents.executeJavaScript(`localStorage.setItem('accessToken', ${JSON.stringify(token)})`);

  const pages = [
    ['02-home', '/'],
    ['03-dictionary', '/dictionary'],
    ['04-snippets', '/snippets'],
    ['05-style', '/style'],
    ['06-scratchpad', '/notes'],
    ['07-note-editor', notes[0] ? `/notes/${notes[0].id}` : '/notes'],
    ['08-transforms', '/transforms'],
    ['09-insights', '/insights'],
    ['10-referral', '/referral'],
    ['11-settings-general', '/settings/general'],
    ['12-settings-system', '/settings/system'],
    ['13-settings-plans', '/settings/plans'],
    ['14-settings-team', '/settings/team'],
    ['15-settings-privacy', '/settings/privacy'],
  ];
  for (const [name, route] of pages) {
    await visit(route);
    await shoot(win, name);
  }
  // Scroll Home to the history list.
  await visit('/');
  await win.webContents.executeJavaScript(`document.querySelector('main').scrollTo(0, 420)`);
  await sleep(300);
  await shoot(win, '16-home-history');

  if (prefs.theme !== THEME) await api('/preferences', token, { method: 'PATCH', body: JSON.stringify({ theme: prefs.theme }) });
  app.quit();
}).catch((err) => {
  console.error(err);
  app.exit(1);
});
