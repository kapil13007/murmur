// File: app/services/groq_key_service.js
// A user's own Groq API key: checked against Groq, stored encrypted, and
// shown back only as its last four characters.
import { settings } from '../core/config.js';
import { badRequest, serviceUnavailable, unprocessable } from '../core/errors.js';
import { encryptSecret } from '../core/secrets.js';
import { updateUser } from '../crud/user_crud.js';

const KEY_FORMAT = /^gsk_[A-Za-z0-9]{20,200}$/;

// Lists models with the key: the cheapest call that proves it is valid.
async function assertKeyWorks(key) {
  let res;
  try {
    res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw serviceUnavailable("Couldn't reach Groq to check the key. Try again in a moment.", { code: 'groq_unreachable' });
  }
  if (res.status === 401 || res.status === 403) {
    throw unprocessable('Groq rejected that key. Copy it again from console.groq.com/keys.', { code: 'groq_key_invalid' });
  }
  if (!res.ok && res.status !== 429) throw serviceUnavailable(`Groq answered with an error (${res.status}).`, { code: 'groq_unreachable' });
}

export const groqKeyStatus = (user) => ({
  has_key: Boolean(user.groq_key_encrypted),
  last4: user.groq_key_last4 || null,
  required: settings.REQUIRE_USER_KEY,
});

export async function saveGroqKey(user, rawKey) {
  const key = String(rawKey || '').trim();
  if (!KEY_FORMAT.test(key)) throw badRequest('A Groq key starts with "gsk_". Copy the whole key from console.groq.com/keys.');
  await assertKeyWorks(key);
  await updateUser(user, { groq_key_encrypted: encryptSecret(key), groq_key_last4: key.slice(-4) });
  return groqKeyStatus(user);
}

export async function removeGroqKey(user) {
  await updateUser(user, { groq_key_encrypted: null, groq_key_last4: null });
  return groqKeyStatus(user);
}
