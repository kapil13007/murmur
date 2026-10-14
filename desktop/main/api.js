// File: desktop/main/api.js
// The desktop app's own client for the Express API (main process).
const os = require('node:os');
const { app } = require('electron');
const { API_BASE } = require('./config');
const store = require('./store');

class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

// Read lazily: the stored token can only be decrypted once the app is ready.
let token;
const currentToken = () => {
  if (token === undefined) token = store.getToken();
  return token;
};
let onUnauthorized = () => {};

async function request(pathname, { method = 'GET', json, form, signal, timeoutMs = 60_000 } = {}) {
  if (!currentToken()) throw new ApiError('Not signed in', 401);
  const headers = { Authorization: `Bearer ${token}` };
  let body;
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  } else if (form) {
    body = form;
  }
  const timeout = AbortSignal.timeout(timeoutMs);
  let res;
  try {
    res = await fetch(`${API_BASE}${pathname}`, {
      method,
      headers,
      body,
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (err) {
    if (err.name === 'AbortError' && signal?.aborted) throw err;
    throw new ApiError("Can't reach the Whisper Flow server. Is the backend running?", 0);
  }
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (res.status === 401) {
    onUnauthorized();
    throw new ApiError('Your session expired. Sign in again from the Flow hub.', 401, data);
  }
  if (!res.ok) throw new ApiError(data?.detail || `Request failed (${res.status})`, res.status, data);
  return data;
}

function wavForm(wav, fields) {
  const form = new FormData();
  form.append('audio', new Blob([wav], { type: 'audio/wav' }), 'dictation.wav');
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null && value !== '') form.append(key, String(value));
  }
  return form;
}

module.exports = {
  ApiError,
  hasSession: () => Boolean(currentToken()),
  getToken: currentToken,
  setToken(next) {
    token = next || null;
    store.setToken(token);
  },
  onUnauthorized(handler) {
    onUnauthorized = handler;
  },
  me: () => request('/users/me'),
  preferences: () => request('/preferences'),
  updatePreferences: (patch) => request('/preferences', { method: 'PATCH', json: patch }),
  lastTranscript: () => request('/history/last'),
  registerDevice: () =>
    request('/devices', {
      method: 'POST',
      json: {
        device_uid: store.deviceUid(),
        platform: process.platform,
        arch: process.arch,
        device_name: os.hostname(),
        app_version: app.getVersion(),
      },
    }),
  transcribe: (wav, context, signal) =>
    request('/dictation/transcribe', { method: 'POST', form: wavForm(wav, context), signal, timeoutMs: 120_000 }),
  command: (wav, context, signal) =>
    request('/dictation/command', { method: 'POST', form: wavForm(wav, context), signal, timeoutMs: 120_000 }),
};
