// File: app/models/index.js
// Initialises every model against the shared Sequelize instance and declares
// the relationships between them. Import models from here, never from the
// individual files, so associations are always registered.
import { sequelize } from '../db/session.js';
import { initUser, User } from './user.js';
import { initUserPreference, UserPreference } from './user_preference.js';
import { initDevice, Device } from './device.js';
import { initSubscription, Subscription } from './subscription.js';
import { initBillingEvent, BillingEvent } from './billing_event.js';
import { initTeam, Team, TeamMember, TeamInvitation } from './team.js';
import { initReferral, Referral } from './referral.js';
import { initTranscript, Transcript } from './transcript.js';
import { initTranscriptAudio, TranscriptAudio } from './transcript_audio.js';
import { initActivity, DailyActivity, AppUsage } from './activity.js';
import { initDictionaryEntry, DictionaryEntry } from './dictionary_entry.js';
import { initStyleProfile, StyleProfile } from './style_profile.js';
import { initNote, Note, NoteVersion } from './note.js';
import { initTransform, Transform, TransformRun, CommandRun } from './transform.js';
import { initNotification, Notification } from './notification.js';

initUser(sequelize);
initUserPreference(sequelize);
initDevice(sequelize);
initSubscription(sequelize);
initBillingEvent(sequelize);
initTeam(sequelize);
initReferral(sequelize);
initTranscript(sequelize);
initTranscriptAudio(sequelize);
initActivity(sequelize);
initDictionaryEntry(sequelize);
initStyleProfile(sequelize);
initNote(sequelize);
initTransform(sequelize);
initNotification(sequelize);

const cascade = { onDelete: 'CASCADE', hooks: true };

// --- User: 1:1 ---
User.hasOne(UserPreference, { as: 'preferences', foreignKey: 'user_id', ...cascade });
UserPreference.belongsTo(User, { as: 'user', foreignKey: 'user_id' });
User.hasOne(Subscription, { as: 'subscription', foreignKey: 'user_id', ...cascade });
Subscription.belongsTo(User, { as: 'user', foreignKey: 'user_id' });

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

User.hasMany(Note, { as: 'notes', foreignKey: 'user_id', onDelete: 'CASCADE' });
Note.belongsTo(User, { as: 'user', foreignKey: 'user_id' });
Note.hasMany(NoteVersion, { as: 'versions', foreignKey: 'note_id', onDelete: 'CASCADE' });
NoteVersion.belongsTo(Note, { as: 'note', foreignKey: 'note_id' });

User.hasMany(Transform, { as: 'transforms', foreignKey: 'user_id', onDelete: 'CASCADE' });
Transform.belongsTo(User, { as: 'user', foreignKey: 'user_id' });
User.hasMany(TransformRun, { as: 'transformRuns', foreignKey: 'user_id', onDelete: 'CASCADE' });
TransformRun.belongsTo(User, { as: 'user', foreignKey: 'user_id' });
Transform.hasMany(TransformRun, { as: 'runs', foreignKey: 'transform_id', onDelete: 'SET NULL' });
TransformRun.belongsTo(Transform, { as: 'transform', foreignKey: 'transform_id' });
Note.hasMany(TransformRun, { as: 'transformRuns', foreignKey: 'note_id', onDelete: 'SET NULL' });
TransformRun.belongsTo(Note, { as: 'note', foreignKey: 'note_id' });

User.hasMany(CommandRun, { as: 'commandRuns', foreignKey: 'user_id', onDelete: 'CASCADE' });
CommandRun.belongsTo(User, { as: 'user', foreignKey: 'user_id' });
Transcript.hasOne(CommandRun, { as: 'commandRun', foreignKey: 'transcript_id', onDelete: 'SET NULL' });
CommandRun.belongsTo(Transcript, { as: 'transcript', foreignKey: 'transcript_id' });

User.hasMany(Notification, { as: 'notifications', foreignKey: 'user_id', onDelete: 'CASCADE' });
Notification.belongsTo(User, { as: 'user', foreignKey: 'user_id' });

User.hasMany(BillingEvent, { as: 'billingEvents', foreignKey: 'user_id', onDelete: 'CASCADE' });
BillingEvent.belongsTo(User, { as: 'user', foreignKey: 'user_id' });
Subscription.hasMany(BillingEvent, { as: 'events', foreignKey: 'subscription_id', onDelete: 'SET NULL' });
BillingEvent.belongsTo(Subscription, { as: 'subscription', foreignKey: 'subscription_id' });

// --- Referrals (self-referencing users) ---
User.belongsTo(User, { as: 'referredBy', foreignKey: 'referred_by_user_id' });
User.hasMany(Referral, { as: 'referralsSent', foreignKey: 'referrer_user_id', onDelete: 'CASCADE' });
Referral.belongsTo(User, { as: 'referrer', foreignKey: 'referrer_user_id' });
Referral.belongsTo(User, { as: 'referredUser', foreignKey: 'referred_user_id' });

// --- Teams (M:N users through team_members) ---
Team.belongsTo(User, { as: 'owner', foreignKey: 'owner_user_id' });
Team.hasMany(TeamMember, { as: 'members', foreignKey: 'team_id', onDelete: 'CASCADE' });
TeamMember.belongsTo(Team, { as: 'team', foreignKey: 'team_id' });
TeamMember.belongsTo(User, { as: 'user', foreignKey: 'user_id' });
User.hasOne(TeamMember, { as: 'membership', foreignKey: 'user_id', onDelete: 'CASCADE' });
Team.belongsToMany(User, { as: 'users', through: TeamMember, foreignKey: 'team_id', otherKey: 'user_id' });
User.belongsToMany(Team, { as: 'teams', through: TeamMember, foreignKey: 'user_id', otherKey: 'team_id' });
Team.hasMany(TeamInvitation, { as: 'invitations', foreignKey: 'team_id', onDelete: 'CASCADE' });
TeamInvitation.belongsTo(Team, { as: 'team', foreignKey: 'team_id' });
TeamInvitation.belongsTo(User, { as: 'invitedBy', foreignKey: 'invited_by_user_id' });
Team.hasMany(DictionaryEntry, { as: 'sharedEntries', foreignKey: 'team_id', onDelete: 'CASCADE' });
DictionaryEntry.belongsTo(Team, { as: 'team', foreignKey: 'team_id' });

export {
  sequelize,
  User,
  UserPreference,
  Device,
  Subscription,
  BillingEvent,
  Team,
  TeamMember,
  TeamInvitation,
  Referral,
  Transcript,
  TranscriptAudio,
  DailyActivity,
  AppUsage,
  DictionaryEntry,
  StyleProfile,
  Note,
  NoteVersion,
  Transform,
  TransformRun,
  CommandRun,
  Notification,
};
