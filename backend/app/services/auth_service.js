// File: app/services/auth_service.js
import crypto from 'node:crypto';
import { HttpError, badRequest, conflict, unauthorized } from '../core/errors.js';
import { isValidTimeZone } from '../core/dates.js';
import { createAccessToken, hashPassword, verifyPassword } from '../core/security.js';
import { withTransaction } from '../db/session.js';
import { createPreferences } from '../crud/preference_crud.js';
import { ensureDefaultStyles } from '../crud/style_crud.js';
import { ensureBuiltinTransforms } from '../crud/transform_crud.js';
import {
  bumpTokenVersion,
  createUser,
  getUserByEmail,
  getUserByReferralCode,
  recordFailedLogin,
  recordSuccessfulLogin,
} from '../crud/user_crud.js';
import { ensureSubscription } from './billing_service.js';
import { sendWelcome } from './notification_service.js';
import { linkReferralOnSignup } from './referral_service.js';
import { acceptPendingInvitationsNotice } from './team_service.js';

// "PREM" + 3 digits, like Wispr Flow's "KAPIL941" referral codes.
async function generateReferralCode(firstName) {
  const base = (firstName || 'FLOW').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8) || 'FLOW';
  for (let attempt = 0; attempt < 20; attempt++) {
    const digits = attempt < 10 ? 3 : 5;
    const code = `${base}${crypto.randomInt(10 ** (digits - 1), 10 ** digits)}`;
    if (!(await getUserByReferralCode(code))) return code;
  }
  return `${base}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

export async function registerUser(data) {
  if (await getUserByEmail(data.email)) {
    throw conflict('An account with this email already exists');
  }
  const referrer = data.referral_code ? await getUserByReferralCode(data.referral_code) : null;
  if (data.referral_code && !referrer) throw badRequest('That referral code is not valid');

  const passwordHash = await hashPassword(data.password);
  const referralCode = await generateReferralCode(data.first_name);
  const timezone = data.timezone && isValidTimeZone(data.timezone) ? data.timezone : 'UTC';

  const user = await withTransaction(async (transaction) => {
    const created = await createUser(
      {
        email: data.email,
        password_hash: passwordHash,
        first_name: data.first_name,
        last_name: data.last_name || null,
        referral_code: referralCode,
        referred_by_user_id: referrer ? referrer.id : null,
      },
      { transaction },
    );
    await createPreferences(created.id, { timezone }, { transaction });
    await ensureSubscription(created.id, { transaction });
    await ensureDefaultStyles(created.id, { transaction });
    await ensureBuiltinTransforms(created.id, { transaction });
    return created;
  });

  await sendWelcome(user);
  if (referrer) await linkReferralOnSignup(referrer, user);
  await acceptPendingInvitationsNotice(user);
  return user;
}

export async function authenticate(email, password) {
  const user = await getUserByEmail(email);
  // Same generic error for "no such user" and "wrong password", and the hash
  // check runs either way so timing doesn't reveal which one it was.
  const valid = await verifyPassword(password, user?.password_hash);
  if (!user) throw unauthorized('Incorrect email or password');
  if (user.isLocked()) {
    throw new HttpError(429, 'Too many failed attempts. Your account is locked for a few minutes.', { code: 'account_locked' });
  }
  if (!valid) {
    await recordFailedLogin(user);
    throw unauthorized('Incorrect email or password');
  }
  await recordSuccessfulLogin(user);
  return user;
}

export async function changePassword(user, oldPassword, newPassword) {
  if (!(await verifyPassword(oldPassword, user.password_hash))) {
    throw badRequest('Current password is incorrect');
  }
  if (oldPassword === newPassword) throw badRequest('New password must be different from the current one');
  user.password_hash = await hashPassword(newPassword);
  // Revoke every other session, then hand this one a fresh token.
  await bumpTokenVersion(user);
  return createAccessToken(user, { rememberMe: true });
}

export async function logoutEverywhere(user) {
  await bumpTokenVersion(user);
}
