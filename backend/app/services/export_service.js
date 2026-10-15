// File: app/services/export_service.js
// "Download your data": everything stored about the user as one JSON file
// (audio recordings excluded, they are binary and expire after 14 days).
import {
  AppUsage,
  CommandRun,
  DailyActivity,
  Device,
  DictionaryEntry,
  Notification,
  StyleProfile,
  Transcript,
  Transform,
  TransformRun,
  UserPreference,
} from '../models/index.js';
import { toUserOut } from '../schemas/user_schema.js';

const plain = (rows) => rows.map((r) => r.get({ plain: true }));

export async function exportUserData(user) {
  const where = { user_id: user.id };
  const [preferences, devices, transcripts, dictionary, styles, transforms, transformRuns, commandRuns, notifications, daily, apps] =
    await Promise.all([
      UserPreference.findByPk(user.id),
      Device.findAll({ where }),
      Transcript.findAll({ where, order: [['created_at', 'DESC']] }),
      DictionaryEntry.findAll({ where }),
      StyleProfile.findAll({ where }),
      Transform.findAll({ where }),
      TransformRun.findAll({ where }),
      CommandRun.findAll({ where }),
      Notification.findAll({ where }),
      DailyActivity.findAll({ where }),
      AppUsage.findAll({ where }),
    ]);
  return {
    exported_at: new Date().toISOString(),
    format_version: 2,
    user: toUserOut(user),
    preferences: preferences?.get({ plain: true }) || null,
    devices: plain(devices),
    transcripts: plain(transcripts),
    dictionary: plain(dictionary.filter((d) => !d.is_snippet)),
    snippets: plain(dictionary.filter((d) => d.is_snippet)),
    styles: plain(styles),
    transforms: plain(transforms),
    transform_runs: plain(transformRuns),
    command_runs: plain(commandRuns),
    notifications: plain(notifications),
    daily_activity: plain(daily),
    app_usage: plain(apps),
  };
}
