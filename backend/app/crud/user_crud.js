// File: app/crud/user_crud.js
import { User } from '../models/index.js';

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MINUTES = 15;

export function getUserById(id, options = {}) {
  return User.findByPk(id, options);
}

export function getUserByEmail(email, options = {}) {
  return User.findOne({ where: { email: String(email).trim().toLowerCase() }, ...options });
}

export function getUserByReferralCode(code, options = {}) {
  return User.findOne({ where: { referral_code: String(code).trim().toUpperCase() }, ...options });
}

export function createUser(data, options = {}) {
  return User.create(data, options);
}

export async function updateUser(user, data, options = {}) {
  Object.assign(user, data);
  await user.save(options);
  return user;
}

// Account lockout: 5 failed logins lock the account for 15 minutes.
export async function recordFailedLogin(user) {
  user.failed_login_count += 1;
  if (user.failed_login_count >= MAX_FAILED_LOGINS) {
    user.locked_until = new Date(Date.now() + LOCKOUT_MINUTES * 60_000);
    user.failed_login_count = 0;
  }
  await user.save();
  return user;
}

export async function recordSuccessfulLogin(user) {
  user.failed_login_count = 0;
  user.locked_until = null;
  user.last_login_at = new Date();
  await user.save();
  return user;
}

// Invalidates every JWT issued so far for this user.
export async function bumpTokenVersion(user, options = {}) {
  user.token_version += 1;
  await user.save(options);
  return user;
}

export function deleteUser(user, options = {}) {
  return user.destroy(options);
}
