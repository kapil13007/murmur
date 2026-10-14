// File: app/services/referral_service.js
// "Refer a friend": both people get a free month of Pro when the invitee
// signs up with the referrer's code.
import { badRequest, conflict } from '../core/errors.js';
import { createReferral, findReferral, listReferrals, updateReferral } from '../crud/referral_crud.js';
import { getUserByEmail } from '../crud/user_crud.js';
import { grantFreeMonth } from './billing_service.js';
import { notify } from './notification_service.js';

export async function getReferralOverview(user) {
  const referrals = await listReferrals(user.id);
  return {
    referral_code: user.referral_code,
    invite_link: `/register?ref=${encodeURIComponent(user.referral_code)}`,
    rewarded_count: referrals.filter((r) => r.status === 'rewarded').length,
    referrals: referrals.map((r) => ({
      id: r.id,
      email: r.referred_email,
      status: r.status,
      name: r.referredUser ? r.referredUser.fullName : null,
      created_at: r.created_at,
      rewarded_at: r.rewarded_at,
    })),
  };
}

export async function inviteFriend(user, email) {
  if (email === user.email) throw badRequest("You can't refer yourself");
  if (await getUserByEmail(email)) throw conflict('That person already has an account');
  if (await findReferral(user.id, email)) throw conflict('You already invited this person');
  // No email service is wired up: the hub shows the invite link to share.
  return createReferral({ referrer_user_id: user.id, referred_email: email, status: 'invited' });
}

export async function linkReferralOnSignup(referrer, newUser) {
  let referral = await findReferral(referrer.id, newUser.email);
  if (!referral) {
    referral = await createReferral({ referrer_user_id: referrer.id, referred_email: newUser.email, status: 'invited' });
  }
  await updateReferral(referral, { referred_user_id: newUser.id, status: 'rewarded', rewarded_at: new Date() });
  await grantFreeMonth(referrer.id, `Referral reward: ${newUser.first_name} joined`);
  await grantFreeMonth(newUser.id, `Referral reward: joined with ${referrer.first_name}'s code`);
  await notify(referrer.id, {
    type: 'milestone',
    key: `referral:rewarded:${referral.id}`,
    title: `${newUser.first_name} joined with your code 🎉`,
    body: 'You both earned a free month of Flow Pro.',
    action_label: 'Refer more friends',
    action_url: '/referral',
  });
}
