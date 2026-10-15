// File: app/services/notification_service.js
// Creates in-app notifications (de-duplicated by key), honours the user's
// notification categories and pushes new ones to open hub windows.
import { createUniqueNotification } from '../crud/notification_crud.js';
import { getPreferences } from '../crud/preference_crud.js';
import { toNotificationOut } from '../schemas/misc_schema.js';
import { publish } from './realtime_service.js';

// Which Settings > Notifications toggle governs each notification type.
// System notifications cannot be switched off.
const SETTING_FOR_TYPE = {
  milestone: 'milestones_and_progress',
  tip: 'tips_and_suggestions',
  learning: 'tips_and_suggestions',
  feature: 'feature_highlights',
};

export async function notify(userId, data, { prefs } = {}) {
  const setting = SETTING_FOR_TYPE[data.type];
  if (setting) {
    const p = prefs || (await getPreferences(userId));
    if (p.notification_settings?.[setting] === false) return null;
  }
  const [notification, created] = await createUniqueNotification(userId, data);
  if (created) publish(userId, 'notification', toNotificationOut(notification));
  return created ? notification : null;
}

export const WORD_MILESTONES = [100, 500, 1000, 2500, 5000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000];
export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 365];

const fmt = (n) => n.toLocaleString('en-US');

export async function checkMilestones(userId, prefs, { wordsBefore, wordsAfter, dayStreak }) {
  for (const milestone of WORD_MILESTONES) {
    if (wordsBefore < milestone && wordsAfter >= milestone) {
      await notify(
        userId,
        {
          type: 'milestone',
          key: `milestone:words:${milestone}`,
          title: `You've dictated ${fmt(milestone)} words!`,
          body: `That's about ${Math.round(milestone / 40)} minutes of typing saved. Keep it going.`,
          action_label: 'See history',
          action_url: '/',
        },
        { prefs },
      );
    }
  }
  if (STREAK_MILESTONES.includes(dayStreak)) {
    await notify(
      userId,
      {
        type: 'milestone',
        key: `milestone:streak:${dayStreak}`,
        title: `${dayStreak}-day streak 🔥`,
        body: `You've used Murmur ${dayStreak} days in a row. Consistency looks good on you.`,
        action_label: 'See history',
        action_url: '/',
      },
      { prefs },
    );
  }
}

export function sendWelcome(user) {
  return notify(user.id, {
    type: 'tip',
    key: 'welcome',
    title: `Welcome to Murmur, ${user.first_name}!`,
    body: 'Hold Ctrl + Win in any app and start speaking. Release to paste clean, formatted text.',
    action_label: 'Try it',
    action_url: '/',
  });
}
