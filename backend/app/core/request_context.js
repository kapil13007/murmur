// File: app/core/request_context.js
// Carries the signed-in user's own Groq key down to the speech-to-text and
// LLM clients without threading it through every function. Set once by the
// auth middleware (see deps.js); read by `groqKey()`.
import { AsyncLocalStorage } from 'node:async_hooks';
import { settings } from './config.js';
import { preconditionRequired } from './errors.js';

const storage = new AsyncLocalStorage();

export const runWithUserKey = (userKey, fn) => storage.run({ userKey }, fn);

// The key to call Groq with: the user's own, or (self-hosted only) the
// server's. With REQUIRE_USER_KEY the server's key is never used.
export function groqKey() {
  const own = storage.getStore()?.userKey;
  if (own) return own;
  return settings.REQUIRE_USER_KEY ? '' : settings.GROQ_API_KEY;
}

// Same, but answers the request with a 428 the apps turn into "add your key".
export function requireGroqKey() {
  const key = groqKey();
  if (!key) {
    throw preconditionRequired('Add your free Groq API key in Settings to start dictating.', { code: 'groq_key_required' });
  }
  return key;
}
