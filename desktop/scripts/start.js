// File: desktop/scripts/start.js
// Launches Electron with a clean environment. Terminals inside VS Code (itself
// an Electron app) export ELECTRON_RUN_AS_NODE=1, which makes electron.exe
// behave like plain Node and never open a window.
//
//   node scripts/start.js [--hidden]
const path = require('node:path');
const { spawn } = require('node:child_process');
const electron = require('electron'); // from Node, this is the binary's path

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electron, [path.resolve(__dirname, '..'), ...process.argv.slice(2)], { stdio: 'inherit', env });
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
