// File: desktop/main/store.js
// Small JSON settings file in the user's app-data folder. The session token
// is encrypted with the OS keychain (DPAPI on Windows) via safeStorage.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { app, safeStorage } = require('electron');

const FILE = path.join(app.getPath('userData'), 'flow-settings.json');

function read() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return {};
  }
}

let data = read();

function save() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function deviceUid() {
  if (!data.deviceUid) {
    data.deviceUid = crypto.randomUUID();
    save();
  }
  return data.deviceUid;
}

// Call after app 'ready': on Windows safeStorage is unavailable before that.
function getToken() {
  if (!data.token) return null;
  try {
    const buf = Buffer.from(data.token, 'base64');
    if (!data.tokenEncrypted) return buf.toString('utf8');
    return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(buf) : null;
  } catch {
    return null;
  }
}

function setToken(token) {
  if (!token) {
    delete data.token;
    delete data.tokenEncrypted;
  } else {
    const encrypted = safeStorage.isEncryptionAvailable();
    data.token = (encrypted ? safeStorage.encryptString(token) : Buffer.from(token, 'utf8')).toString('base64');
    data.tokenEncrypted = encrypted;
  }
  save();
}

function get(key, fallback) {
  return data[key] === undefined ? fallback : data[key];
}

function set(key, value) {
  data[key] = value;
  save();
}

module.exports = { deviceUid, getToken, setToken, get, set };
