// File: desktop/main/flowbar.js
// Main-process side of the Murmur bar: drives its UI state and its recorder.
// The recorder runs in the bar's renderer (getUserMedia + AudioWorklet) and
// hands back a 16 kHz WAV when told to stop.
const { ipcMain } = require('electron');
const { getBar } = require('./windows');

let nextRequest = 1;
const pending = new Map();
let visibleWhenIdle = true;
let lastState = { state: 'idle' };
const stateListeners = new Set();

function send(channel, payload) {
  const bar = getBar();
  if (bar) bar.webContents.send(channel, payload);
}

function applyVisibility() {
  const bar = getBar();
  if (!bar) return;
  const busy = lastState.state !== 'idle';
  if (busy || visibleWhenIdle) {
    if (!bar.isVisible()) bar.showInactive();
  } else if (bar.isVisible()) {
    bar.hide();
  }
}

function setState(state) {
  lastState = state;
  send('bar:state', state);
  applyVisibility();
  for (const listener of stateListeners) listener(state);
}

function onStateChange(listener) {
  stateListeners.add(listener);
  return () => stateListeners.delete(listener);
}

function setVisibleWhenIdle(value) {
  visibleWhenIdle = value;
  applyVisibility();
}

function call(action, data = {}, timeoutMs = 5000) {
  const requestId = nextRequest++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(requestId);
      reject(new Error(`Murmur bar did not answer "${action}"`));
    }, timeoutMs);
    pending.set(requestId, { resolve, reject, timer });
    send('bar:record', { action, requestId, ...data });
  });
}

ipcMain.on('bar:reply', (event, { requestId, ok, error, ...data }) => {
  const waiter = pending.get(requestId);
  if (!waiter) return;
  pending.delete(requestId);
  clearTimeout(waiter.timer);
  if (ok) waiter.resolve(data);
  else waiter.reject(new Error(error || 'recorder error'));
});

ipcMain.on('bar:interactive', (event, interactive) => {
  const bar = getBar();
  if (bar) bar.setIgnoreMouseEvents(!interactive, { forward: true });
});

module.exports = {
  setState,
  onStateChange,
  setVisibleWhenIdle,
  // Resolves once the microphone is open and samples are flowing.
  startRecording: (options) => call('start', options, 8000),
  // Resolves to { wav: Buffer, duration, peak }.
  stopRecording: () =>
    call('stop', {}, 8000).then((data) => ({ ...data, wav: Buffer.from(data.wav) })),
  cancelRecording: () => call('cancel', {}, 3000).catch(() => {}),
  playSound: (name) => send('bar:sound', name),
  toast: (message) => send('bar:toast', message),
};
