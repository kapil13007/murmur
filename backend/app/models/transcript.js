// File: app/models/transcript.js
// One dictation: raw ASR text, AI-formatted text, user edits and the context
// it was spoken in. Mirrors Wispr Flow's `History` table.
import { DataTypes, Model } from 'sequelize';
import { DICTATION_MODES, STYLE_CATEGORIES, TRANSCRIPT_STATUSES } from './constants.js';

export class Transcript extends Model {
  // The text the user ultimately wants: their edit, else the AI output
  // (or the raw transcript when they chose "Undo AI edit").
  get displayText() {
    if (this.edited_text) return this.edited_text;
    if (this.has_reverted_ai) return this.asr_text || '';
    return this.formatted_text || this.asr_text || '';
  }
}

export function initTranscript(sequelize) {
  Transcript.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      user_id: { type: DataTypes.UUID, allowNull: false },
      device_id: { type: DataTypes.UUID, allowNull: true },
      status: {
        type: DataTypes.STRING(12),
        allowNull: false,
        defaultValue: 'success',
        validate: { isIn: [TRANSCRIPT_STATUSES] },
      },
      mode: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: 'push_to_talk',
        validate: { isIn: [DICTATION_MODES] },
      },
      asr_text: { type: DataTypes.TEXT, allowNull: true },
      formatted_text: { type: DataTypes.TEXT, allowNull: true },
      edited_text: { type: DataTypes.TEXT, allowNull: true },
      app_name: { type: DataTypes.STRING(255), allowNull: true },
      app_category: { type: DataTypes.STRING(12), allowNull: true, validate: { isIn: [STYLE_CATEGORIES] } },
      url: { type: DataTypes.STRING(512), allowNull: true },
      window_title: { type: DataTypes.TEXT, allowNull: true },
      language: { type: DataTypes.STRING(10), allowNull: true },
      detected_language: { type: DataTypes.STRING(10), allowNull: true },
      num_words: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      duration_seconds: { type: DataTypes.REAL, allowNull: false, defaultValue: 0 },
      speech_duration_seconds: { type: DataTypes.REAL, allowNull: true },
      asr_provider: { type: DataTypes.STRING(20), allowNull: true },
      asr_model: { type: DataTypes.STRING(120), allowNull: true },
      formatter: { type: DataTypes.STRING(20), allowNull: true },
      llm_model: { type: DataTypes.STRING(120), allowNull: true },
      asr_latency_ms: { type: DataTypes.INTEGER, allowNull: true },
      format_latency_ms: { type: DataTypes.INTEGER, allowNull: true },
      e2e_latency_ms: { type: DataTypes.INTEGER, allowNull: true },
      personalization: { type: DataTypes.JSONB, allowNull: false, defaultValue: () => ({}) },
      num_dictionary_replacements: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      num_snippets_expanded: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      mic_device: { type: DataTypes.STRING(255), allowNull: true },
      is_archived: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      has_reverted_ai: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      feedback: { type: DataTypes.TEXT, allowNull: true },
      error_message: { type: DataTypes.TEXT, allowNull: true },
      timezone_offset_minutes: { type: DataTypes.INTEGER, allowNull: true },
      app_version: { type: DataTypes.STRING(30), allowNull: true },
      platform: { type: DataTypes.STRING(20), allowNull: true },
    },
    { sequelize, modelName: 'Transcript', tableName: 'transcripts' },
  );
  return Transcript;
}
