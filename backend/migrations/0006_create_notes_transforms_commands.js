// Migration 0006: Scratchpad notes, AI transforms and Command Mode runs.
// `notes` / `note_versions` mirror Wispr Flow's `Notes` / `NoteVersions`.
// `transforms` holds the Polish prompt and custom transforms; each execution
// is logged in `transform_runs` (Wispr's `Polish` table). Voice commands on
// selected text are logged in `command_runs` (Wispr's `InstructHistory`).
import { uuidPk, timestamps, createdAt, fk, checkIn } from '../app/db/migration_helpers.js';

export async function up({ queryInterface, Sequelize }) {
  await queryInterface.createTable('notes', {
    id: uuidPk(Sequelize),
    user_id: fk(Sequelize, 'users'),
    title: { type: Sequelize.STRING(255), allowNull: false, defaultValue: '' },
    content: { type: Sequelize.TEXT, allowNull: false, defaultValue: '' },
    content_preview: { type: Sequelize.STRING(300), allowNull: false, defaultValue: '' },
    // Lower-cased title + content, used by search.
    searchable_content: { type: Sequelize.TEXT, allowNull: false, defaultValue: '' },
    is_pinned: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    source: { type: Sequelize.STRING(12), allowNull: false, defaultValue: 'typed' },
    ...timestamps(Sequelize),
  });
  await checkIn(queryInterface, 'notes', 'source', ['typed', 'dictated']);
  await queryInterface.addIndex('notes', ['user_id', 'is_pinned', 'updated_at'], { name: 'idx_notes_user_pinned_updated' });

  await queryInterface.createTable('note_versions', {
    id: uuidPk(Sequelize),
    note_id: fk(Sequelize, 'notes'),
    title: { type: Sequelize.STRING(255), allowNull: false, defaultValue: '' },
    content: { type: Sequelize.TEXT, allowNull: false },
    source: { type: Sequelize.STRING(20), allowNull: false },
    transform_prompt: { type: Sequelize.TEXT, allowNull: true },
    ...createdAt(Sequelize),
  });
  await checkIn(queryInterface, 'note_versions', 'source', ['snapshot', 'transform', 'restore']);
  await queryInterface.addIndex('note_versions', ['note_id', 'created_at'], { name: 'idx_note_versions_note_created' });

  await queryInterface.createTable('transforms', {
    id: uuidPk(Sequelize),
    user_id: fk(Sequelize, 'users'),
    name: { type: Sequelize.STRING(100), allowNull: false },
    instruction: { type: Sequelize.TEXT, allowNull: false },
    icon: { type: Sequelize.STRING(30), allowNull: true },
    is_builtin: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    is_enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
    sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    ...timestamps(Sequelize),
  });
  await queryInterface.addConstraint('transforms', {
    type: 'unique',
    fields: ['user_id', 'name'],
    name: 'uq_transforms_user_name',
  });

  await queryInterface.createTable('transform_runs', {
    id: uuidPk(Sequelize),
    user_id: fk(Sequelize, 'users'),
    transform_id: fk(Sequelize, 'transforms', { allowNull: true, onDelete: 'SET NULL' }),
    note_id: fk(Sequelize, 'notes', { allowNull: true, onDelete: 'SET NULL' }),
    instruction: { type: Sequelize.TEXT, allowNull: false },
    input_text: { type: Sequelize.TEXT, allowNull: false },
    output_text: { type: Sequelize.TEXT, allowNull: true },
    input_word_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    output_word_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    app_name: { type: Sequelize.STRING(255), allowNull: true },
    status: { type: Sequelize.STRING(12), allowNull: false, defaultValue: 'success' },
    provider: { type: Sequelize.STRING(20), allowNull: true },
    model: { type: Sequelize.STRING(120), allowNull: true },
    processing_ms: { type: Sequelize.INTEGER, allowNull: true },
    is_undone: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    ...createdAt(Sequelize),
  });
  await checkIn(queryInterface, 'transform_runs', 'status', ['success', 'no_changes', 'error']);
  await queryInterface.addIndex('transform_runs', ['user_id', 'created_at'], { name: 'idx_transform_runs_user_created' });

  await queryInterface.createTable('command_runs', {
    id: uuidPk(Sequelize),
    user_id: fk(Sequelize, 'users'),
    transcript_id: fk(Sequelize, 'transcripts', { allowNull: true, onDelete: 'SET NULL' }),
    instruction: { type: Sequelize.TEXT, allowNull: false },
    selected_text: { type: Sequelize.TEXT, allowNull: true },
    output_text: { type: Sequelize.TEXT, allowNull: true },
    app_name: { type: Sequelize.STRING(255), allowNull: true },
    status: { type: Sequelize.STRING(12), allowNull: false, defaultValue: 'success' },
    provider: { type: Sequelize.STRING(20), allowNull: true },
    model: { type: Sequelize.STRING(120), allowNull: true },
    processing_ms: { type: Sequelize.INTEGER, allowNull: true },
    ...createdAt(Sequelize),
  });
  await checkIn(queryInterface, 'command_runs', 'status', ['success', 'error', 'unsupported']);
  await queryInterface.addIndex('command_runs', ['user_id', 'created_at'], { name: 'idx_command_runs_user_created' });
}

export async function down({ queryInterface }) {
  await queryInterface.dropTable('command_runs');
  await queryInterface.dropTable('transform_runs');
  await queryInterface.dropTable('transforms');
  await queryInterface.dropTable('note_versions');
  await queryInterface.dropTable('notes');
}
