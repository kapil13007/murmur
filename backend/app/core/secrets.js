// File: app/core/secrets.js
// Encrypts small secrets (users' Groq keys) before they reach the database:
// AES-256-GCM with a key derived from KEY_ENCRYPTION_SECRET (or SECRET_KEY).
// Stored as base64(iv | auth tag | ciphertext). Changing the secret makes old
// values unreadable, so users are simply asked for their key again.
import crypto from 'node:crypto';
import { settings } from './config.js';

const key = () => crypto.createHash('sha256').update(settings.KEY_ENCRYPTION_SECRET || settings.SECRET_KEY).digest();

export function encryptSecret(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
}

export function decryptSecret(stored) {
  if (!stored) return null;
  try {
    const raw = Buffer.from(stored, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
