// File: app/core/dates.js
// Calendar maths in the user's own time zone (streaks, "today", weekly
// allowances) using only the built-in Intl API.

export function isValidTimeZone(tz) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// "YYYY-MM-DD" for the given instant as seen in `tz`.
export function localDate(tz, instant = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(instant);
  } catch {
    return instant.toISOString().slice(0, 10);
  }
}

export function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromStr, toStr) {
  return Math.round((Date.parse(`${toStr}T00:00:00Z`) - Date.parse(`${fromStr}T00:00:00Z`)) / 86_400_000);
}

// Weeks start on Sunday, like Wispr Flow's weekly word allowance.
export function weekStart(dateStr) {
  const day = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return addDays(dateStr, -day);
}

function offsetMinutes(tz, instant) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

// The UTC instant at which `dateStr` begins in `tz` (DST-safe).
export function startOfLocalDay(dateStr, tz) {
  const guess = Date.parse(`${dateStr}T00:00:00Z`);
  try {
    let instant = guess - offsetMinutes(tz, new Date(guess)) * 60_000;
    instant = guess - offsetMinutes(tz, new Date(instant)) * 60_000;
    return new Date(instant);
  } catch {
    return new Date(guess);
  }
}
