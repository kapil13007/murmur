// Migration 0008: Murmur personal edition.
// Murmur is a one-person app, so the team, billing and referral features and
// the Scratchpad notes are removed together with their data. One-way: going
// back means restoring a database backup.
import { checkIn } from '../app/db/migration_helpers.js';

const DROPPED_TABLES = [
  // Children before parents, so no CASCADE is needed.
  'team_invitations',
  'team_members',
  'referrals',
  'billing_events',
  'subscriptions',
  'note_versions',
  'notes',
  'teams',
];

const NOTIFICATION_TYPES = ['milestone', 'tip', 'feature', 'system', 'learning'];

export async function up({ queryInterface }) {
  const run = (sql) => queryInterface.sequelize.query(sql);

  // Columns that point at the tables being removed (their foreign keys,
  // unique constraints and indexes go with them).
  await run('ALTER TABLE dictionary_entries DROP COLUMN IF EXISTS team_id');
  await run('ALTER TABLE transform_runs DROP COLUMN IF EXISTS note_id');
  await run('ALTER TABLE users DROP COLUMN IF EXISTS referred_by_user_id');
  await run('ALTER TABLE users DROP COLUMN IF EXISTS referral_code');
  await run('ALTER TABLE user_preferences DROP COLUMN IF EXISTS notes_view');

  for (const table of DROPPED_TABLES) await run(`DROP TABLE IF EXISTS "${table}"`);

  // Notifications that only made sense with teams and plans.
  await run("DELETE FROM notifications WHERE type IN ('team', 'usage', 'billing')");
  await run('ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check');
  await checkIn(queryInterface, 'notifications', 'type', NOTIFICATION_TYPES);
  await run("UPDATE notifications SET action_url = '/', action_label = 'See history' WHERE action_url = '/insights'");
  await run(
    `UPDATE notifications SET action_url = NULL, action_label = NULL
      WHERE action_url LIKE '/settings/plans%' OR action_url LIKE '/settings/team%'
         OR action_url LIKE '/referral%' OR action_url LIKE '/notes%'`,
  );
  await run("UPDATE notifications SET title = replace(title, 'Whisper Flow', 'Murmur') WHERE title LIKE '%Whisper Flow%'");
  await run("UPDATE user_preferences SET notification_settings = notification_settings - 'team_updates'");
}

export async function down() {
  throw new Error(
    'Migration 0008_personal_edition is one-way: it deleted team, billing, referral and note data. Restore a database backup to go back.',
  );
}
