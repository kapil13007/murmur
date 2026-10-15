// File: app/models/user_preference.js
// One row per user (1:1 with users). Mirrors Wispr Flow's `prefs.user`
// settings object: formatting, languages, microphone, shortcuts, sounds,
// privacy and notification preferences.
import { DataTypes, Model } from 'sequelize';
import {
  CLEANUP_LEVELS,
  DATA_RETENTION,
  DEFAULT_SHORTCUTS,
  THEMES,
} from './constants.js';

export class UserPreference extends Model {}

export function initUserPreference(sequelize) {
  UserPreference.init(
    {
      user_id: { type: DataTypes.UUID, primaryKey: true },
      ai_formatting: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      auto_cleanup_level: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: 'light',
        validate: { isIn: [CLEANUP_LEVELS] },
      },
      smart_formatting: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      selected_languages: { type: DataTypes.ARRAY(DataTypes.STRING(10)), allowNull: false, defaultValue: ['en'] },
      ui_locale: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'en' },
      timezone: { type: DataTypes.STRING(64), allowNull: false, defaultValue: 'UTC' },
      microphone_device_id: { type: DataTypes.TEXT, allowNull: true },
      microphone_label: { type: DataTypes.TEXT, allowNull: true },
      shortcuts: { type: DataTypes.JSONB, allowNull: false, defaultValue: () => ({ ...DEFAULT_SHORTCUTS }) },
      enable_sounds: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      mute_audio_while_dictating: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      open_at_login: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      show_flow_bar: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      show_in_taskbar: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      auto_add_to_dictionary: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      context_awareness: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      command_mode_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      email_auto_signature: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      email_signature: { type: DataTypes.TEXT, allowNull: true },
      polish_instructions: { type: DataTypes.JSONB, allowNull: false },
      privacy_mode: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      data_retention: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'store',
        validate: { isIn: [DATA_RETENTION] },
      },
      notification_settings: { type: DataTypes.JSONB, allowNull: false },
      theme: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'light', validate: { isIn: [THEMES] } },
      dictionary_sort: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'newest' },
      flow_bar_position: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'bottom' },
      user_information: { type: DataTypes.JSONB, allowNull: false, defaultValue: () => ({}) },
      typing_locations: { type: DataTypes.ARRAY(DataTypes.STRING(50)), allowNull: false, defaultValue: [] },
    },
    { sequelize, modelName: 'UserPreference', tableName: 'user_preferences' },
  );
  return UserPreference;
}
