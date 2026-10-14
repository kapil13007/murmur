// File: app/core/security.js
// Password hashing (bcrypt) and session tokens (JWT, HS256).
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { settings } from './config.js';

const BCRYPT_ROUNDS = 12;
const ALGORITHM = 'HS256';

export const ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES;
// "Remember me" tokens are long-lived (the desktop app always uses them). The
// only way to revoke one early is bumping the user's `token_version`.
export const REMEMBER_ME_EXPIRE_DAYS = settings.REMEMBER_ME_EXPIRE_DAYS;

// Verified against when a login email doesn't exist, so response timing can't
// reveal whether an account exists (user enumeration).
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('timing-equalization-dummy', BCRYPT_ROUNDS);

export function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain, hashed) {
  return bcrypt.compare(plain, hashed || DUMMY_PASSWORD_HASH);
}

export function createAccessToken(user, { rememberMe = false } = {}) {
  const expiresIn = rememberMe ? `${REMEMBER_ME_EXPIRE_DAYS}d` : `${ACCESS_TOKEN_EXPIRE_MINUTES}m`;
  const token = jwt.sign({ sub: user.id, ver: user.token_version }, settings.SECRET_KEY, {
    algorithm: ALGORITHM,
    expiresIn,
  });
  const expiresAt = rememberMe
    ? new Date(Date.now() + REMEMBER_ME_EXPIRE_DAYS * 86_400_000)
    : new Date(Date.now() + ACCESS_TOKEN_EXPIRE_MINUTES * 60_000);
  return { access_token: token, token_type: 'bearer', expires_at: expiresAt.toISOString() };
}

export function decodeAccessToken(token) {
  return jwt.verify(token, settings.SECRET_KEY, { algorithms: [ALGORITHM] });
}
