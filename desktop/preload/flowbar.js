// File: desktop/preload/flowbar.js
// Exposes `window.flowBar` to the Murmur bar renderer (see main/flowbar.js for
// the message protocol).
const { contextBridge, ipcRenderer } = require('electron');

function listen(channel, callback) {
  const handler = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld('flowBar', {
  onState: (callback) => listen('bar:state', callback),
  onRecord: (callback) => listen('bar:record', callback),
  onSound: (callback) => listen('bar:sound', callback),
  onToast: (callback) => listen('bar:toast', callback),
  onPosition: (callback) => listen('bar:position', callback),
  reply: (payload) => ipcRenderer.send('bar:reply', payload),
  // true while the pointer is over the pill, so clicks land on the bar
  // instead of passing through to the app underneath.
  setInteractive: (interactive) => ipcRenderer.send('bar:interactive', Boolean(interactive)),
  // 'start' | 'stop' | 'cancel' | 'open-hub'
  action: (name) => ipcRenderer.send('bar:action', name),
});
