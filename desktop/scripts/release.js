// File: desktop/scripts/release.js
// Publishes the current desktop version as a GitHub release that installed
// copies of Murmur pick up automatically.
//
//   1. bump "version" in desktop/package.json (it must be higher than the last release)
//   2. npm run release -- "What changed"
//
// Builds the installer, then attaches the three files the updater needs:
// Murmur-Setup.exe, its .blockmap (for small delta downloads) and latest.yml.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, execSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const tag = `v${version}`;
const notes = process.argv.slice(2).join(' ').trim() || `Murmur ${version}`;
const REPO = 'kapil13007/murmur';

const run = (command) => execSync(command, { cwd: root, stdio: 'inherit' });

// Refuse to overwrite a published version: installed apps compare version numbers.
try {
  execFileSync('gh', ['release', 'view', tag, '--repo', REPO], { stdio: 'ignore' });
  console.error(`Release ${tag} already exists. Bump the version in desktop/package.json first.`);
  process.exit(1);
} catch {
  // not published yet: good
}

run('npm run dist');
const dist = path.join(root, 'dist');
const files = ['Murmur-Setup.exe', 'Murmur-Setup.exe.blockmap', 'latest.yml'].map((f) => path.join(dist, f));
for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error(`Missing ${path.relative(root, file)}; the build did not produce it.`);
    process.exit(1);
  }
}
execFileSync('gh', ['release', 'create', tag, ...files, '--repo', REPO, '--title', `Murmur ${version}`, '--notes', notes, '--latest'], { stdio: 'inherit' });
console.log(`Published ${tag}. Installed copies of Murmur will update themselves within a few hours.`);
