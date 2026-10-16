// File: app/core/deps.js
// Request dependencies shared by routers.
import multer from 'multer';
import { getUserById } from '../crud/user_crud.js';
import { unauthorized } from './errors.js';
import { runWithUserKey } from './request_context.js';
import { decryptSecret } from './secrets.js';
import { decodeAccessToken } from './security.js';

// Resolves the bearer token to `req.user` or answers 401. Tokens issued
// before the user's token_version was bumped (password change, "log out
// everywhere") are rejected.
export async function getCurrentActiveUser(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (!token || scheme.toLowerCase() !== 'bearer') return next(unauthorized());
  let payload;
  try {
    payload = decodeAccessToken(token);
  } catch {
    return next(unauthorized());
  }
  const user = await getUserById(payload.sub);
  if (!user || payload.ver !== user.token_version) return next(unauthorized());
  req.user = user;
  // Everything below this middleware sees the user's own Groq key.
  return runWithUserKey(decryptSecret(user.groq_key_encrypted), () => next());
}

// Audio uploads are kept in memory: dictations are small (16 kHz mono WAV is
// ~32 KB per second; Wispr caps a dictation at ~6 minutes).
export const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
});
