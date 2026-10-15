// File: app/models/index.js
// Initialises every model against the shared Sequelize instance and declares
// the relationships between them. Import models from here, never from the
// individual files, so associations are always registered.
import { sequelize } from '../db/session.js';
import { initUser, User } from './user.js';
import { initUserPreference, UserPreference } from './user_preference.js';
import { initDevice, Device } from './device.js';
import { initTranscript, Transcript } from './transcript.js';
import { initTranscriptAudio, TranscriptAudio } from './transcript_audio.js';
import { initActivity, DailyActivity, AppUsage } from './activity.js';
import { initDictionaryEntry, DictionaryEntry } from './dictionary_entry.js';
import { initStyleProfile, StyleProfile } from './style_profile.js';
import { initTransform, Transform, TransformRun, CommandRun } from './transform.js';
import { initNotification, Notification } from './notification.js';

initUser(sequelize);
initUserPreference(sequelize);
initDevice(sequelize);
initTranscript(sequelize);
initTranscriptAudio(sequelize);
initActivity(sequelize);
initDictionaryEntry(sequelize);
initStyleProfile(sequelize);
initTransform(sequelize);
initNotification(sequelize);

const cascade = { onDelete: 'CASCADE', hooks: true };

// --- User: 1:1 ---
User.hasOne(UserPreference, { as: 'preferences', foreignKey: 'user_id', ...cascade });
UserPreference.belongsTo(User, { as: 'user', foreignKey: 'user_id' });

// --- User: 1:N ---
User.hasMany(Device, { as: 'devices', foreignKey: 'user_id', ...cascade });
Device.belongsTo(User, { as: 'user', foreignKey: 'user_id' });

User.hasMany(Transcript, { as: 'transcripts', foreignKey: 'user_id', onDelete: 'CASCADE' });
Transcript.belongsTo(User, { as: 'user', foreignKey: 'user_id' });
Device.hasMany(Transcript, { as: 'transcripts', foreignKey: 'device_id', onDelete: 'SET NULL' });
Transcript.belongsTo(Device, { as: 'device', foreignKey: 'device_id' });
Transcript.hasOne(TranscriptAudio, { as: 'audio', foreignKey: 'transcript_id', onDelete: 'CASCADE' });
TranscriptAudio.belongsTo(Transcript, { as: 'transcript', foreignKey: 'transcript_id' });

User.hasMany(DailyActivity, { as: 'dailyActivity', foreignKey: 'user_id', onDelete: 'CASCADE' });
DailyActivity.belongsTo(User, { as: 'user', foreignKey: 'user_id' });
User.hasMany(AppUsage, { as: 'appUsage', foreignKey: 'user_id', onDelete: 'CASCADE' });
AppUsage.belongsTo(User, { as: 'user', foreignKey: 'user_id' });

User.hasMany(DictionaryEntry, { as: 'dictionaryEntries', foreignKey: 'user_id', onDelete: 'CASCADE' });
DictionaryEntry.belongsTo(User, { as: 'owner', foreignKey: 'user_id' });

User.hasMany(StyleProfile, { as: 'styleProfiles', foreignKey: 'user_id', onDelete: 'CASCADE' });
StyleProfile.belongsTo(User, { as: 'user', foreignKey: 'user_id' });

User.hasMany(Transform, { as: 'transforms', foreignKey: 'user_id', onDelete: 'CASCADE' });
Transform.belongsTo(User, { as: 'user', foreignKey: 'user_id' });
User.hasMany(TransformRun, { as: 'transformRuns', foreignKey: 'user_id', onDelete: 'CASCADE' });
TransformRun.belongsTo(User, { as: 'user', foreignKey: 'user_id' });
Transform.hasMany(TransformRun, { as: 'runs', foreignKey: 'transform_id', onDelete: 'SET NULL' });
TransformRun.belongsTo(Transform, { as: 'transform', foreignKey: 'transform_id' });

User.hasMany(CommandRun, { as: 'commandRuns', foreignKey: 'user_id', onDelete: 'CASCADE' });
CommandRun.belongsTo(User, { as: 'user', foreignKey: 'user_id' });
Transcript.hasOne(CommandRun, { as: 'commandRun', foreignKey: 'transcript_id', onDelete: 'SET NULL' });
CommandRun.belongsTo(Transcript, { as: 'transcript', foreignKey: 'transcript_id' });

User.hasMany(Notification, { as: 'notifications', foreignKey: 'user_id', onDelete: 'CASCADE' });
Notification.belongsTo(User, { as: 'user', foreignKey: 'user_id' });

export {
  sequelize,
  User,
  UserPreference,
  Device,
  Transcript,
  TranscriptAudio,
  DailyActivity,
  AppUsage,
  DictionaryEntry,
  StyleProfile,
  Transform,
  TransformRun,
  CommandRun,
  Notification,
};
