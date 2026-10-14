// File: app/crud/activity_crud.js
// Upserts for the per-day and per-app rollups (atomic increments in SQL).
import { Op } from 'sequelize';
import { AppUsage, DailyActivity, sequelize } from '../models/index.js';

export function incrementDailyActivity(userId, date, { words, duration }, options = {}) {
  return sequelize.query(
    `INSERT INTO daily_activity (user_id, activity_date, words, dictations, duration_seconds)
     VALUES (:userId, :date, :words, 1, :duration)
     ON CONFLICT (user_id, activity_date) DO UPDATE SET
       words = daily_activity.words + EXCLUDED.words,
       dictations = daily_activity.dictations + 1,
       duration_seconds = daily_activity.duration_seconds + EXCLUDED.duration_seconds`,
    { replacements: { userId, date, words, duration }, ...options },
  );
}

export function incrementAppUsage(userId, appName, category, words, options = {}) {
  return sequelize.query(
    `INSERT INTO app_usage (user_id, app_name, app_category, words, dictations, last_used_at)
     VALUES (:userId, :appName, :category, :words, 1, NOW())
     ON CONFLICT (user_id, app_name) DO UPDATE SET
       words = app_usage.words + EXCLUDED.words,
       dictations = app_usage.dictations + 1,
       app_category = EXCLUDED.app_category,
       last_used_at = NOW()`,
    { replacements: { userId, appName, category, words }, ...options },
  );
}

export function getDailyActivity(userId, fromDate, toDate) {
  return DailyActivity.findAll({
    where: { user_id: userId, activity_date: { [Op.between]: [fromDate, toDate] } },
    order: [['activity_date', 'ASC']],
    raw: true,
  });
}

export function getActiveDates(userId) {
  return DailyActivity.findAll({
    where: { user_id: userId, words: { [Op.gt]: 0 } },
    attributes: ['activity_date'],
    order: [['activity_date', 'DESC']],
    raw: true,
  }).then((rows) => rows.map((r) => r.activity_date));
}

export async function getTotals(userId) {
  const [row] = await sequelize.query(
    `SELECT COALESCE(SUM(words), 0)::int AS words,
            COALESCE(SUM(dictations), 0)::int AS dictations,
            COALESCE(SUM(duration_seconds), 0)::float AS duration
       FROM daily_activity WHERE user_id = :userId`,
    { replacements: { userId }, type: sequelize.QueryTypes.SELECT },
  );
  return row;
}

export async function sumWordsSince(userId, fromDate) {
  const [row] = await sequelize.query(
    `SELECT COALESCE(SUM(words), 0)::int AS words FROM daily_activity
      WHERE user_id = :userId AND activity_date >= :fromDate`,
    { replacements: { userId, fromDate }, type: sequelize.QueryTypes.SELECT },
  );
  return row.words;
}

export function listAppUsage(userId, limit = 10) {
  return AppUsage.findAll({
    where: { user_id: userId },
    order: [['words', 'DESC']],
    limit,
    raw: true,
  });
}

export function countApps(userId) {
  return AppUsage.count({ where: { user_id: userId } });
}
