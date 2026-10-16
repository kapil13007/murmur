// File: desktop/main/protocol.js
// Serves the bundled hub (desktop/hub, a copy of frontend/dist) under
// murmur://app/, so the installed app needs no website. Unknown paths fall
// back to index.html because the hub uses client-side routing.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { net, protocol } = require('electron');
const { HUB_DIR, HUB_SCHEME } = require('./config');

// Must run before the app is ready.
function registerScheme() {
  protocol.registerSchemesAsPrivileged([
    { scheme: HUB_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
  ]);
}

function serveHub() {
  const root = path.resolve(HUB_DIR);
  protocol.handle(HUB_SCHEME, (request) => {
    const { pathname } = new URL(request.url);
    let file = path.resolve(root, `.${decodeURIComponent(pathname)}`);
    // Never serve anything outside the hub folder.
    if (!file.startsWith(root + path.sep) && file !== root) return new Response('Forbidden', { status: 403 });
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      // A missing asset is a 404; a missing page is the app's own route.
      if (path.extname(file)) return new Response('Not found', { status: 404 });
      file = path.join(root, 'index.html');
    }
    return net.fetch(pathToFileURL(file).toString());
  });
}

module.exports = { registerScheme, serveHub };
