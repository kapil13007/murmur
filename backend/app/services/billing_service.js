// File: app/services/billing_service.js
// Plans, trials and subscriptions. Checkout is simulated: it records the
// purchase and activates the plan without contacting a payment processor,
// so the whole upgrade/cancel/resume lifecycle can be exercised locally.
import { settings } from '../core/config.js';
import { badRequest, conflict } from '../core/errors.js';
import {
  createBillingEvent,
  createSubscription,
  getSubscription,
  listBillingEvents,
  updateSubscription,
} from '../crud/subscription_crud.js';
import { PLANS } from '../models/constants.js';
import { notify } from './notification_service.js';

const DAY = 86_400_000;

export const PLAN_CATALOG = Object.freeze([
  {
    id: PLANS.BASIC,
    name: 'Basic',
    tagline: 'Try Flow for free',
    price_cents: { month: 0, year: 0 },
    weekly_word_limit: settings.BASIC_WEEKLY_WORD_LIMIT,
    features: [
      `${settings.BASIC_WEEKLY_WORD_LIMIT.toLocaleString('en-US')} words per week`,
      'Dictation in any app',
      'Personal dictionary and snippets',
      'Writing styles per app',
    ],
  },
  {
    id: PLANS.PRO,
    name: 'Pro',
    tagline: 'For people who write all day',
    price_cents: { month: 1500, year: 14400 },
    weekly_word_limit: null,
    features: [
      'Everything in Basic, plus:',
      'Unlimited words',
      'Command Mode and Transforms',
      'AI auto-cleanup levels',
      'Early access to new features',
    ],
  },
  {
    id: PLANS.TEAMS,
    name: 'Teams',
    tagline: 'For teams that move fast',
    price_cents: { month: 1200, year: 12000 },
    per_seat: true,
    weekly_word_limit: null,
    features: [
      'Everything in Pro, plus:',
      'Shared dictionary and snippets',
      'Centralized billing',
      'Team usage insights',
    ],
  },
]);

const planName = (id) => PLAN_CATALOG.find((p) => p.id === id)?.name || 'Basic';

export async function ensureSubscription(userId, { transaction, startTrial = true } = {}) {
  const existing = await getSubscription(userId, { transaction });
  if (existing) return existing;
  const now = new Date();
  if (startTrial && settings.PRO_TRIAL_DAYS > 0) {
    const sub = await createSubscription(
      {
        user_id: userId,
        plan: PLANS.PRO,
        status: 'trialing',
        source: 'trial',
        trial_started_at: now,
        trial_ends_at: new Date(now.getTime() + settings.PRO_TRIAL_DAYS * DAY),
      },
      { transaction },
    );
    await createBillingEvent(
      {
        user_id: userId,
        subscription_id: sub.id,
        event_type: 'trial_started',
        plan: PLANS.PRO,
        description: `${settings.PRO_TRIAL_DAYS}-day Flow Pro trial started`,
      },
      { transaction },
    );
    return sub;
  }
  return createSubscription({ user_id: userId, plan: PLANS.BASIC, status: 'none' }, { transaction });
}

// Applies time-based transitions lazily: expired trials and ended billing
// periods drop back to Basic the next time the subscription is read.
async function refreshState(sub) {
  const now = new Date();
  if (sub.status === 'trialing' && sub.trial_ends_at && sub.trial_ends_at <= now) {
    await updateSubscription(sub, { plan: PLANS.BASIC, status: 'none', source: null });
    await createBillingEvent({ user_id: sub.user_id, subscription_id: sub.id, event_type: 'trial_ended', plan: PLANS.BASIC, description: 'Pro trial ended' });
    await notify(sub.user_id, {
      type: 'billing',
      key: `billing:trial_ended:${sub.trial_ends_at.toISOString().slice(0, 10)}`,
      title: 'Your Pro trial has ended',
      body: `You're now on Flow Basic with ${settings.BASIC_WEEKLY_WORD_LIMIT.toLocaleString('en-US')} words per week. Upgrade anytime for unlimited dictation.`,
      action_label: 'See plans',
      action_url: '/settings/plans',
    });
  } else if (
    (sub.status === 'active' || sub.status === 'canceled') &&
    sub.current_period_end &&
    sub.current_period_end <= now
  ) {
    if (sub.cancel_at_period_end || sub.status === 'canceled') {
      await updateSubscription(sub, { plan: PLANS.BASIC, status: 'none', cancel_at_period_end: false, billing_interval: null });
      await createBillingEvent({ user_id: sub.user_id, subscription_id: sub.id, event_type: 'subscription_ended', plan: PLANS.BASIC, description: 'Subscription ended' });
    } else {
      // Simulated auto-renewal for the next period.
      const months = sub.billing_interval === 'year' ? 12 : 1;
      const start = sub.current_period_end;
      const end = new Date(start);
      end.setUTCMonth(end.getUTCMonth() + months);
      await updateSubscription(sub, { current_period_start: start, current_period_end: end });
      const plan = PLAN_CATALOG.find((p) => p.id === sub.plan);
      await createBillingEvent({
        user_id: sub.user_id,
        subscription_id: sub.id,
        event_type: 'payment_succeeded',
        plan: sub.plan,
        amount_cents: sub.is_student ? 0 : plan?.price_cents[sub.billing_interval || 'month'] || 0,
        description: `${planName(sub.plan)} renewal`,
      });
    }
  }
  return sub;
}

export async function getActiveSubscription(userId) {
  const sub = await ensureSubscription(userId);
  return refreshState(sub);
}

export function toSubscriptionSummary(sub) {
  const now = new Date();
  const isPro = sub.isPro(now);
  const daysLeft = sub.status === 'trialing' && sub.trial_ends_at ? Math.max(0, Math.ceil((sub.trial_ends_at - now) / DAY)) : null;
  return {
    plan: sub.plan,
    plan_name: planName(sub.plan),
    status: sub.status,
    is_pro: isPro,
    is_trial: sub.status === 'trialing',
    is_student: sub.is_student,
    trial_ends_at: sub.trial_ends_at,
    trial_days_left: daysLeft,
    total_trial_days: settings.PRO_TRIAL_DAYS,
    billing_interval: sub.billing_interval,
    current_period_end: sub.current_period_end,
    cancel_at_period_end: sub.cancel_at_period_end,
    weekly_word_limit: isPro ? null : settings.BASIC_WEEKLY_WORD_LIMIT,
  };
}

export async function getSubscriptionSummary(userId) {
  return toSubscriptionSummary(await getActiveSubscription(userId));
}

export async function checkout(userId, { plan, interval, seats, card_last4 }) {
  const sub = await getActiveSubscription(userId);
  if (sub.status === 'active' && sub.plan === plan && !sub.cancel_at_period_end) {
    throw conflict(`You're already on ${planName(plan)}`);
  }
  const catalog = PLAN_CATALOG.find((p) => p.id === plan);
  const amount = catalog.price_cents[interval] * (catalog.per_seat ? seats : 1);
  const start = new Date();
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + (interval === 'year' ? 12 : 1));
  await updateSubscription(sub, {
    plan,
    status: 'active',
    source: 'checkout',
    billing_interval: interval,
    current_period_start: start,
    current_period_end: end,
    cancel_at_period_end: false,
    canceled_at: null,
    trial_ends_at: sub.status === 'trialing' ? start : sub.trial_ends_at,
  });
  await createBillingEvent({
    user_id: userId,
    subscription_id: sub.id,
    event_type: 'payment_succeeded',
    plan,
    amount_cents: amount,
    description: `${planName(plan)} (${interval === 'year' ? 'annual' : 'monthly'}${catalog.per_seat ? `, ${seats} seat${seats > 1 ? 's' : ''}` : ''}) - card ending ${card_last4}`,
    metadata: { interval, seats, card_last4, simulated: true },
  });
  await notify(userId, {
    type: 'billing',
    key: `billing:upgraded:${sub.id}:${start.getTime()}`,
    title: `Welcome to Flow ${planName(plan)}!`,
    body: 'Unlimited dictation, Command Mode and Transforms are unlocked.',
  });
  return toSubscriptionSummary(sub);
}

export async function cancelSubscription(userId) {
  const sub = await getActiveSubscription(userId);
  if (sub.status === 'trialing') {
    await updateSubscription(sub, { plan: PLANS.BASIC, status: 'none', trial_ends_at: new Date(), canceled_at: new Date() });
    await createBillingEvent({ user_id: userId, subscription_id: sub.id, event_type: 'trial_canceled', plan: PLANS.BASIC, description: 'Pro trial canceled' });
    return toSubscriptionSummary(sub);
  }
  if (sub.status !== 'active') throw badRequest('There is no active subscription to cancel');
  await updateSubscription(sub, { cancel_at_period_end: true, canceled_at: new Date() });
  await createBillingEvent({
    user_id: userId,
    subscription_id: sub.id,
    event_type: 'cancel_scheduled',
    plan: sub.plan,
    description: `Cancels on ${sub.current_period_end.toISOString().slice(0, 10)}`,
  });
  return toSubscriptionSummary(sub);
}

export async function resumeSubscription(userId) {
  const sub = await getActiveSubscription(userId);
  if (!(sub.status === 'active' && sub.cancel_at_period_end)) throw badRequest('Nothing to resume');
  await updateSubscription(sub, { cancel_at_period_end: false, canceled_at: null });
  await createBillingEvent({ user_id: userId, subscription_id: sub.id, event_type: 'cancel_reverted', plan: sub.plan, description: 'Subscription resumed' });
  return toSubscriptionSummary(sub);
}

export async function claimStudentPlan(userId) {
  const sub = await getActiveSubscription(userId);
  if (sub.is_student && sub.status === 'active') throw conflict('The student plan is already active');
  const start = new Date();
  const end = new Date(start);
  end.setUTCFullYear(end.getUTCFullYear() + 1);
  await updateSubscription(sub, {
    plan: PLANS.PRO,
    status: 'active',
    source: 'student',
    is_student: true,
    billing_interval: 'year',
    current_period_start: start,
    current_period_end: end,
    cancel_at_period_end: false,
  });
  await createBillingEvent({ user_id: userId, subscription_id: sub.id, event_type: 'student_plan_claimed', plan: PLANS.PRO, description: 'Free Pro for students (1 year)' });
  return toSubscriptionSummary(sub);
}

// Referral reward: one extra month of Pro on top of whatever is active.
export async function grantFreeMonth(userId, reason, { transaction } = {}) {
  const sub = await getActiveSubscription(userId);
  const now = new Date();
  if (sub.status === 'trialing') {
    const base = sub.trial_ends_at > now ? sub.trial_ends_at : now;
    await updateSubscription(sub, { trial_ends_at: new Date(base.getTime() + 30 * DAY) }, { transaction });
  } else if (sub.status === 'active') {
    const end = new Date(sub.current_period_end > now ? sub.current_period_end : now);
    end.setUTCMonth(end.getUTCMonth() + 1);
    await updateSubscription(sub, { current_period_end: end }, { transaction });
  } else {
    await updateSubscription(
      sub,
      { plan: PLANS.PRO, status: 'trialing', source: 'referral', trial_started_at: now, trial_ends_at: new Date(now.getTime() + 30 * DAY) },
      { transaction },
    );
  }
  await createBillingEvent(
    { user_id: userId, subscription_id: sub.id, event_type: 'free_month_granted', plan: sub.plan, description: reason },
    { transaction },
  );
  return sub;
}

export function getBillingHistory(userId) {
  return listBillingEvents(userId);
}
