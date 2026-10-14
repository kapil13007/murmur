// File: app/crud/referral_crud.js
import { Referral, User } from '../models/index.js';

export function listReferrals(userId) {
  return Referral.findAll({
    where: { referrer_user_id: userId },
    include: [{ model: User, as: 'referredUser', attributes: ['id', 'first_name', 'last_name'] }],
    order: [['created_at', 'DESC']],
  });
}

export function findReferral(referrerId, email, options = {}) {
  return Referral.findOne({ where: { referrer_user_id: referrerId, referred_email: email.toLowerCase() }, ...options });
}

export function createReferral(data, options = {}) {
  return Referral.create(data, options);
}

export async function updateReferral(referral, data, options = {}) {
  Object.assign(referral, data);
  await referral.save(options);
  return referral;
}
