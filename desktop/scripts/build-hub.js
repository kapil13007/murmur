// File: desktop/scripts/build-hub.js
// Builds the hub (frontend/) and copies it to desktop/hub, which the app
// serves as murmur://app and the installer ships as a resource.
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const frontend = path.resolve(__dirname, '..', '..', 'frontend');
const target = path.resolve(__dirname, '..', 'hub');

if (!fs.existsSync(path.join(frontend, 'node_modules'))) {
  execSync('npm install', { cwd: frontend, stdio: 'inherit' });
}
execSync('npm run build', { cwd: frontend, stdio: 'inherit' });
fs.rmSync(target, { recursive: true, force: true });
fs.cpSync(path.join(frontend, 'dist'), target, { recursive: true });
console.log(`[hub] Copied frontend/dist to ${path.relative(process.cwd(), target)}`);
