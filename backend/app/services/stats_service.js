// File: app/services/stats_service.js
// Home-page stat pills: totals, words per minute, streaks and time saved,
// computed from the usage rollups.
import { daysBetween, localDate, weekStart } from '../core/dates.js';
import { countApps, getActiveDates, getTotals, sumWordsSince } from '../crud/activity_crud.js';

const TYPING_WPM = 40; // average typing speed used for "time saved"

export function computeStreaks(activeDatesDesc, today) {
  const dates = activeDatesDesc; // newest first, unique
  let current = 0;
  if (dates.length) {
    const gap = daysBetween(dates[0], today);
    // A streak survives until the end of the day after the last dictation.
    if (gap <= 1) {
      current = 1;
      for (let i = 1; i < dates.length && daysBetween(dates[i], dates[i - 1]) === 1; i++) current++;
    }
  }
  let longest = 0;
  let run = 0;
  for (let i = 0; i < dates.length; i++) {
    run = i > 0 && daysBetween(dates[i], dates[i - 1]) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  // Week streak: consecutive Sunday-based weeks with any activity.
  const weeks = [...new Set(dates.map(weekStart))];
  let weekStreak = 0;
  if (weeks.length) {
    const thisWeek = weekStart(today);
    const startGap = daysBetween(weeks[0], thisWeek) / 7;
    if (startGap <= 1) {
      weekStreak = 1;
      for (let i = 1; i < weeks.length && daysBetween(weeks[i], weeks[i - 1]) === 7; i++) weekStreak++;
    }
  }
  return { day_streak: current, longest_day_streak: longest, week_streak: weekStreak };
}

export async function getSummary(userId, timezone) {
  const today = localDate(timezone);
  const [totals, activeDates, wordsToday, wordsThisWeek, totalApps] = await Promise.all([
    getTotals(userId),
    getActiveDates(userId),
    sumWordsSince(userId, today),
    sumWordsSince(userId, weekStart(today)),
    countApps(userId),
  ]);
  const minutes = totals.duration / 60;
  const averageWpm = minutes > 0.05 ? Math.round(totals.words / minutes) : 0;
  const timeSaved = Math.max(0, totals.words / TYPING_WPM - minutes);
  return {
    total_words: totals.words,
    total_dictations: totals.dictations,
    total_duration_seconds: Math.round(totals.duration),
    // Capped so a few very short dictations can't show absurd speeds.
    average_wpm: Math.min(averageWpm, 300),
    words_today: wordsToday,
    words_this_week: wordsThisWeek,
    total_apps: totalApps,
    time_saved_minutes: Math.round(timeSaved),
    ...computeStreaks(activeDates, today),
  };
}
