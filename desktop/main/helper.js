// File: desktop/main/helper.js
// Bridge to FlowHelper.exe (global keyboard hook, paste/copy, foreground app,
// system mute). Commands go out as tab-separated lines, JSON comes back.
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { spawn } = require('node:child_process');
const { app } = require('electron');
const { ROOT } = require('./config');

function helperPath() {
  const candidates = [
    path.join(process.resourcesPath || '', 'FlowHelper.exe'), // packaged (extraResources)
    path.join(ROOT, 'helper', 'bin', 'FlowHelper.exe'), // development
  ];
  return candidates.find((p) => p && fs.existsSync(p)) || null;
}

class Helper extends EventEmitter {
  constructor() {
    super();
    this.child = null;
    this.ready = false;
    this.nextId = 1;
    this.pending = new Map();
    this.bindingsLine = null;
    this.stopping = false;
    this.restarts = 0;
  }

  get available() {
    return process.platform === 'win32' && Boolean(helperPath());
  }

  start() {
    const exe = helperPath();
    if (process.platform !== 'win32' || !exe) {
      this.emit('unavailable', 'FlowHelper.exe not found (run "npm run build:helper")');
      return;
    }
    this.child = spawn(exe, [], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let buffer = '';
    this.child.stdout.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line) this.handle(line);
      }
    });
    this.child.stderr.on('data', (d) => console.error('[helper]', d.toString().trim()));
    this.child.on('exit', (code) => {
      this.ready = false;
      for (const { reject } of this.pending.values()) reject(new Error('helper exited'));
      this.pending.clear();
      if (this.stopping) return;
      // Restart a crashed helper a few times; shortcuts are essential.
      if (this.restarts++ < 5) {
        console.warn(`[helper] exited with ${code}; restarting`);
        setTimeout(() => this.start(), 500 * this.restarts);
      } else {
        this.emit('unavailable', 'FlowHelper keeps crashing');
      }
    });
  }

  handle(line) {
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    switch (msg.type) {
      case 'ready':
        this.ready = true;
        if (this.bindingsLine) this.write(this.bindingsLine);
        this.emit('ready', msg);
        break;
      case 'result': {
        const waiter = this.pending.get(msg.id);
        if (waiter) {
          this.pending.delete(msg.id);
          if (msg.ok) waiter.resolve(msg);
          else waiter.reject(new Error(msg.error || 'helper command failed'));
        }
        break;
      }
      case 'hotkey':
        this.emit('hotkey', msg.action, msg.phase);
        break;
      case 'capture':
        this.emit('capture', msg.keys, msg.final);
        break;
      default:
        if (msg.message) console.log('[helper]', msg.message);
    }
  }

  write(line) {
    if (this.child && this.child.stdin.writable) this.child.stdin.write(`${line}\n`);
  }

  request(command, timeoutMs = 3000) {
    if (!this.child || !this.ready) return Promise.reject(new Error('helper not running'));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`helper ${command} timed out`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (v) => (clearTimeout(timer), resolve(v)),
        reject: (e) => (clearTimeout(timer), reject(e)),
      });
      this.write(`${command}\t${id}`);
    });
  }

  // shortcuts: { push_to_talk: ['Ctrl','Win'], ... }
  setBindings(shortcuts) {
    const parts = Object.entries(shortcuts || {})
      .filter(([, keys]) => Array.isArray(keys) && keys.length)
      .map(([action, keys]) => `${action}:${keys.join('+')}`);
    this.bindingsLine = `bindings\t${parts.join('|')}`;
    if (this.ready) this.write(this.bindingsLine);
  }

  setRecording(on) {
    this.write(`state\t${on ? 'recording' : 'idle'}`);
  }

  startCapture() {
    this.write('capture\tstart');
  }

  stopCapture() {
    this.write('capture\tstop');
  }

  foreground() {
    return this.request('foreground', 2000).catch(() => null);
  }

  paste() {
    return this.request('paste');
  }

  copy() {
    return this.request('copy');
  }

  mute() {
    return this.request('mute').catch(() => null);
  }

  unmute() {
    return this.request('unmute').catch(() => null);
  }

  stop() {
    this.stopping = true;
    if (this.child) {
      try {
        this.child.stdin.end();
      } catch {
        // already gone
      }
      setTimeout(() => this.child && !this.child.killed && this.child.kill(), 1000).unref();
    }
  }
}

module.exports = new Helper();
app.on('will-quit', () => module.exports.stop());
