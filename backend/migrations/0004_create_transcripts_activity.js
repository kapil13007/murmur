// Migration 0004: dictation history and usage rollups.
// `transcripts` mirrors Wispr Flow's local `History` table (asrText,
// formattedText, editedText, app, url, duration, numWords, e2eLatency,
// isArchived, personalizationStyleSettings, ...). Audio blobs live in their
// own table so history queries never drag megabytes of audio along.
import { uuidPk, timestamps, createdAt, fk, checkIn } from '../app/db/migration_helpers.js';

export async function up({ queryInterface, Sequelize }) {
  await queryInterface.createTable('transcripts', {
    id: uuidPk(Sequelize),
    user_id: fk(Sequelize, 'users'),
    device_id: fk(Sequelize, 'devices', { allowNull: true, onDelete: 'SET NULL' }),
    status: { type: Sequelize.STRING(12), allowNull: false, defaultValue: 'success' },
    mode: { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'push_to_talk' },
    asr_text: { type: Sequelize.TEXT, allowNull: true },
    formatted_text: { type: Sequelize.TEXT, allowNull: true },
    edited_text: { type: Sequelize.TEXT, allowNull: true },
    app_name: { type: Sequelize.STRING(255), allowNull: true },
    app_category: { type: Sequelize.STRING(12), allowNull: true },
    url: { type: Sequelize.STRING(512), allowNull: true },
    window_title: { type: Sequelize.TEXT, allowNull: true },
    language: { type: Sequelize.STRING(10), allowNull: true },
    detected_language: { type: Sequelize.STRING(10), allowNull: true },
    num_words: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    duration_seconds: { type: Sequelize.REAL, allowNull: false, defaultValue: 0 },
    speech_duration_seconds: { type: Sequelize.REAL, allowNull: true },
    asr_provider: { type: Sequelize.STRING(20), allowNull: true },
    asr_model: { type: Sequelize.STRING(120), allowNull: true },
    formatter: { type: Sequelize.STRING(20), allowNull: true },
    llm_model: { type: Sequelize.STRING(120), allowNull: true },
    asr_latency_ms: { type: Sequelize.INTEGER, allowNull: true },
    format_latency_ms: { type: Sequelize.INTEGER, allowNull: true },
    e2e_latency_ms: { type: Sequelize.INTEGER, allowNull: true },
    personalization: { type: Sequelize.JSONB, allowNull: false, defaultValue: Sequelize.literal("'{}'::jsonb") },
    num_dictionary_replacements: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    num_snippets_expanded: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    mic_device: { type: Sequelize.STRING(255), allowNull: true },
    is_archived: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    has_reverted_ai: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    feedback: { type: Sequelize.TEXT, allowNull: true },
    error_message: { type: Sequelize.TEXT, allowNull: true },
    timezone_offset_minutes: { type: Sequelize.INTEGER, allowNull: true },
    app_version: { type: Sequelize.STRING(30), allowNull: true },
    platform: { type: Sequelize.STRING(20), allowNull: true },
    ...timestamps(Sequelize),
  });
  await checkIn(queryInterface, 'transcripts', 'status', ['success', 'empty', 'no_audio', 'error', 'dismissed']);
  await checkIn(queryInterface, 'transcripts', 'mode', ['push_to_talk', 'hands_free', 'command', 'web', 'retry']);
  await checkIn(queryInterface, 'transcripts', 'app_category', ['personal', 'work', 'email', 'other']);
  await queryInterface.sequelize.query(
    'CREATE INDEX idx_transcripts_user_created ON transcripts (user_id, created_at DESC)',
  );
  await queryInterface.addIndex('transcripts', ['user_id', 'is_archived', 'created_at'], {
    name: 'idx_transcripts_user_archived_created',
  });
  await queryInterface.addIndex('transcripts', ['user_id', 'app_name'], { name: 'idx_transcripts_user_app' });

  // Trigram index for "Search past transcripts" (pg_trgm is a trusted
  // extension, so the database owner can enable it without superuser).
  try {
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    await queryInterface.sequelize.query(
      'CREATE INDEX idx_transcripts_formatted_trgm ON transcripts USING gin (formatted_text gin_trgm_ops)',
    );
  } catch {
    // Search still works without the index, just slower on very large histories.
  }

  await queryInterface.createTable('transcript_audio', {
    transcript_id: { ...fk(Sequelize, 'transcripts'), primaryKey: true },
    mime_type: { type: Sequelize.STRING(50), allowNull: false, defaultValue: 'audio/wav' },
    sample_rate: { type: Sequelize.INTEGER, allowNull: true },
    size_bytes: { type: Sequelize.INTEGER, allowNull: false },
    data: { type: Sequelize.BLOB, allowNull: false },
    ...createdAt(Sequelize),
  });
  await queryInterface.addIndex('transcript_audio', ['created_at'], { name: 'idx_transcript_audio_created' });

  // Per-day rollup: powers streaks, the Insights heatmap and the weekly
  // word allowance, and survives transcript deletion / privacy settings.
  await queryInterface.createTable('daily_activity', {
    user_id: { ...fk(Sequelize, 'users'), primaryKey: true },
    activity_date: { type: Sequelize.DATEONLY, allowNull: false, primaryKey: true },
    words: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    dictations: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    duration_seconds: { type: Sequelize.REAL, allowNull: false, defaultValue: 0 },
  });

  // Per-app rollup: "Top apps" and "Total apps used" on Insights.
  await queryInterface.createTable('app_usage', {
    user_id: { ...fk(Sequelize, 'users'), primaryKey: true },
    app_name: { type: Sequelize.STRING(255), allowNull: false, primaryKey: true },
    app_category: { type: Sequelize.STRING(12), allowNull: true },
    words: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    dictations: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    last_used_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
  });
}

export async function down({ queryInterface }) {
  await queryInterface.dropTable('app_usage');
  await queryInterface.dropTable('daily_activity');
  await queryInterface.dropTable('transcript_audio');
  await queryInterface.dropTable('transcripts');
}
