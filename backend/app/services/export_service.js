// File: app/services/export_service.js
// "Download your data": everything stored about the user as one JSON file
// (audio recordings excluded, they are binary and expire after 14 days).
import {
  AppUsage,
  BillingEvent,
  CommandRun,
  DailyActivity,
  Device,
  DictionaryEntry,
  Note,
  NoteVersion,
  Notification,
  Referral,
  StyleProfile,
  Subscription,
  Transcript,
  Transform,
  TransformRun,
  UserPreference,
} from '../models/index.js';
import { toUserOut } from '../schemas/user_schema.js';

const plain = (rows) => rows.map((r) => r.get({ plain: true }));

export async function exportUserData(user) {
  const where = { user_id: user.id };
  const [preferences, subscription, devices, transcripts, dictionary, styles, notes, transforms, transformRuns, commandRuns, notifications, billing, daily, apps, referrals] =
    await Promise.all([
      UserPreference.findByPk(user.id),
      Subscription.findOne({ where }),
      Device.findAll({ where }),
      Transcript.findAll({ where, order: [['created_at', 'DESC']] }),
      DictionaryEntry.findAll({ where }),
      StyleProfile.findAll({ where }),
      Note.findAll({ where, include: [{ model: NoteVersion, as: 'versions' }] }),
      Transform.findAll({ where }),
      TransformRun.findAll({ where }),
      CommandRun.findAll({ where }),
      Notification.findAll({ where }),
      BillingEvent.findAll({ where }),
      DailyActivity.findAll({ where }),
      AppUsage.findAll({ where }),
      Referral.findAll({ where: { referrer_user_id: user.id } }),
    ]);
  return {
    exported_at: new Date().toISOString(),
    format_version: 1,
    user: toUserOut(user),
    preferences: preferences?.get({ plain: true }) || null,
    subscription: subscription?.get({ plain: true }) || null,
    devices: plain(devices),
    transcripts: plain(transcripts),
    dictionary: plain(dictionary.filter((d) => !d.is_snippet)),
    snippets: plain(dictionary.filter((d) => d.is_snippet)),
    styles: plain(styles),
    notes: plain(notes),
    transforms: plain(transforms),
    transform_runs: plain(transformRuns),
    command_runs: plain(commandRuns),
    notifications: plain(notifications),
    billing_events: plain(billing),
    daily_activity: plain(daily),
    app_usage: plain(apps),
    referrals: plain(referrals),
  };
}
