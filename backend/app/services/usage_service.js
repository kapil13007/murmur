// File: app/services/usage_service.js
// Weekly word allowance for Flow Basic (Wispr: "2,000 words per week, resets
// Sunday"). Pro, Teams and trials are unlimited.
import { paymentRequired } from '../core/errors.js';
import { addDays, localDate, startOfLocalDay, weekStart } from '../core/dates.js';
import { sumWordsSince } from '../crud/activity_crud.js';

export async function getWeeklyUsage(userId, timezone, subscriptionSummary) {
  const today = localDate(timezone);
  const start = weekStart(today);
  const used = await sumWordsSince(userId, start);
  const limit = subscriptionSummary.weekly_word_limit;
  return {
    words_used: used,
    limit,
    remaining: limit === null ? null : Math.max(0, limit - used),
    is_unlimited: limit === null,
    week_start: start,
    resets_at: startOfLocalDay(addDays(start, 7), timezone).toISOString(),
  };
}

export async function assertCanDictate(userId, timezone, subscriptionSummary) {
  const usage = await getWeeklyUsage(userId, timezone, subscriptionSummary);
  if (!usage.is_unlimited && usage.remaining <= 0) {
    throw paymentRequired(
      `You've used all ${usage.limit.toLocaleString('en-US')} words for this week. Upgrade to Pro for unlimited dictation.`,
      { code: 'weekly_limit_reached', extra: { usage } },
    );
  }
  return usage;
}
