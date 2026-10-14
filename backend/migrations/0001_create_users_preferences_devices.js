// Migration 0001: accounts, per-user settings and registered devices.
// Mirrors Wispr Flow's `prefs.user` object (profile + preferences) and the
// `/api/v1/user/register_device` registry, split into normalised tables.
import { uuidPk, timestamps, fk, checkIn } from '../app/db/migration_helpers.js';

const DEFAULT_SHORTCUTS = {
  push_to_talk: ['Ctrl', 'Win'],
  hands_free: ['Ctrl', 'Win', 'Space'],
  command_mode: ['Ctrl', 'Win', 'Alt'],
  paste_last: ['Shift', 'Alt', 'Z'],
  copy_last: ['Shift', 'Alt', 'X'],
  cancel: ['Esc'],
};

const DEFAULT_POLISH = {
  make_more_concise: true,
  clarify_main_point: false,
  maintain_your_tone: true,
  reword_for_clarity: true,
  reorder_for_readability: true,
  refine_phrasing_for_impact: false,
  add_structure_for_readability: true,
};

const DEFAULT_NOTIFICATIONS = {
  tips_and_suggestions: true,
  feature_highlights: true,
  milestones_and_progress: true,
  team_updates: true,
};

const jsonDefault = (Sequelize, value) => Sequelize.literal(`'${JSON.stringify(value)}'::jsonb`);

export async function up({ queryInterface, Sequelize }) {
  // gen_random_uuid() is built into PostgreSQL 13+; pgcrypto covers older servers.
  await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

  await queryInterface.createTable('users', {
    id: uuidPk(Sequelize),
    email: { type: Sequelize.STRING(255), allowNull: false, unique: true },
    password_hash: { type: Sequelize.STRING(255), allowNull: false },
    first_name: { type: Sequelize.STRING(100), allowNull: false },
    last_name: { type: Sequelize.STRING(100), allowNull: true },
    avatar_url: { type: Sequelize.TEXT, allowNull: true },
    referral_code: { type: Sequelize.STRING(20), allowNull: false, unique: true },
    referred_by_user_id: fk(Sequelize, 'users', { allowNull: true, onDelete: 'SET NULL' }),
    product_intent: { type: Sequelize.STRING(30), allowNull: true },
    onboarding_completed: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    onboarding_completed_at: { type: Sequelize.DATE, allowNull: true },
    // Bumped to revoke every outstanding JWT ("log out everywhere").
    token_version: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    failed_login_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    locked_until: { type: Sequelize.DATE, allowNull: true },
    last_login_at: { type: Sequelize.DATE, allowNull: true },
    ...timestamps(Sequelize),
  });

  await queryInterface.createTable('user_preferences', {
    user_id: { ...fk(Sequelize, 'users'), primaryKey: true },
    ai_formatting: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
    auto_cleanup_level: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'light' },
    smart_formatting: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
    // Empty array = auto-detect the spoken language.
    selected_languages: {
      type: Sequelize.ARRAY(Sequelize.STRING(10)),
      allowNull: false,
      defaultValue: Sequelize.literal("ARRAY['en']::varchar(10)[]"),
    },
    ui_locale: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'en' },
    timezone: { type: Sequelize.STRING(64), allowNull: false, defaultValue: 'UTC' },
    microphone_device_id: { type: Sequelize.TEXT, allowNull: true },
    microphone_label: { type: Sequelize.TEXT, allowNull: true },
    shortcuts: { type: Sequelize.JSONB, allowNull: false, defaultValue: jsonDefault(Sequelize, DEFAULT_SHORTCUTS) },
    enable_sounds: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
    mute_audio_while_dictating: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
    open_at_login: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
    show_flow_bar: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
    show_in_taskbar: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
    auto_add_to_dictionary: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
    context_awareness: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
    command_mode_enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
    email_auto_signature: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    email_signature: { type: Sequelize.TEXT, allowNull: true },
    polish_instructions: { type: Sequelize.JSONB, allowNull: false, defaultValue: jsonDefault(Sequelize, DEFAULT_POLISH) },
    privacy_mode: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    data_retention: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'store' },
    notification_settings: {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: jsonDefault(Sequelize, DEFAULT_NOTIFICATIONS),
    },
    theme: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'light' },
    dictionary_sort: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'newest' },
    notes_view: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'grid' },
    flow_bar_position: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'bottom' },
    user_information: { type: Sequelize.JSONB, allowNull: false, defaultValue: jsonDefault(Sequelize, {}) },
    typing_locations: {
      type: Sequelize.ARRAY(Sequelize.STRING(50)),
      allowNull: false,
      defaultValue: Sequelize.literal("'{}'::varchar(50)[]"),
    },
    ...timestamps(Sequelize),
  });
  await checkIn(queryInterface, 'user_preferences', 'auto_cleanup_level', ['none', 'light', 'medium', 'high']);
  await checkIn(queryInterface, 'user_preferences', 'data_retention', ['store', 'auto_delete_24h', 'never_store']);
  await checkIn(queryInterface, 'user_preferences', 'theme', ['light', 'dark', 'system']);
  await checkIn(queryInterface, 'user_preferences', 'notes_view', ['grid', 'list']);
  await checkIn(queryInterface, 'user_preferences', 'flow_bar_position', ['bottom', 'top']);

  await queryInterface.createTable('devices', {
    id: uuidPk(Sequelize),
    user_id: fk(Sequelize, 'users'),
    device_uid: { type: Sequelize.STRING(100), allowNull: false },
    platform: { type: Sequelize.STRING(20), allowNull: false },
    arch: { type: Sequelize.STRING(20), allowNull: true },
    device_name: { type: Sequelize.STRING(255), allowNull: true },
    app_version: { type: Sequelize.STRING(30), allowNull: true },
    last_seen_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
    ...timestamps(Sequelize),
  });
  await queryInterface.addConstraint('devices', {
    type: 'unique',
    fields: ['user_id', 'device_uid'],
    name: 'uq_devices_user_device_uid',
  });
}

export async function down({ queryInterface }) {
  await queryInterface.dropTable('devices');
  await queryInterface.dropTable('user_preferences');
  await queryInterface.dropTable('users');
}
