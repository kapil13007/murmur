// Migration 0005: vocabulary, snippets and per-category writing styles.
// `dictionary_entries` mirrors Wispr Flow's `Dictionary` table, which stores
// both vocabulary words and snippets (isSnippet) with an optional
// replacement, team sharing (teamDictionaryId), stars and usage counters.
// `style_profiles` mirrors the `userVoices` preference (work / email /
// personal / other, each with a formal / casual / very casual / excited style).
import { uuidPk, timestamps, fk, checkIn } from '../app/db/migration_helpers.js';

export async function up({ queryInterface, Sequelize }) {
  await queryInterface.createTable('dictionary_entries', {
    id: uuidPk(Sequelize),
    user_id: fk(Sequelize, 'users'),
    // Set when the entry is shared with the owner's team.
    team_id: fk(Sequelize, 'teams', { allowNull: true, onDelete: 'CASCADE' }),
    // Vocabulary word, misspelling to correct, or snippet trigger phrase.
    phrase: { type: Sequelize.STRING(255), allowNull: false },
    // Correct spelling (vocabulary) or expansion text (snippet).
    replacement: { type: Sequelize.TEXT, allowNull: true },
    is_snippet: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    is_starred: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    source: { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'manual' },
    frequency_used: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    last_used_at: { type: Sequelize.DATE, allowNull: true },
    ...timestamps(Sequelize),
  });
  await checkIn(queryInterface, 'dictionary_entries', 'source', ['manual', 'auto_learned', 'import', 'default']);
  await queryInterface.sequelize.query(
    'CREATE UNIQUE INDEX uq_dictionary_user_phrase ON dictionary_entries (user_id, lower(phrase), is_snippet)',
  );
  await queryInterface.addIndex('dictionary_entries', ['team_id', 'is_snippet'], { name: 'idx_dictionary_team_snippet' });
  await queryInterface.addIndex('dictionary_entries', ['user_id', 'is_snippet', 'created_at'], {
    name: 'idx_dictionary_user_snippet_created',
  });

  await queryInterface.createTable('style_profiles', {
    id: uuidPk(Sequelize),
    user_id: fk(Sequelize, 'users'),
    category: { type: Sequelize.STRING(12), allowNull: false },
    name: { type: Sequelize.STRING(100), allowNull: false },
    app_names: {
      type: Sequelize.ARRAY(Sequelize.STRING(100)),
      allowNull: false,
      defaultValue: Sequelize.literal("'{}'::varchar(100)[]"),
    },
    style: { type: Sequelize.STRING(12), allowNull: false, defaultValue: 'formal' },
    ...timestamps(Sequelize),
  });
  await checkIn(queryInterface, 'style_profiles', 'category', ['personal', 'work', 'email', 'other']);
  await checkIn(queryInterface, 'style_profiles', 'style', ['formal', 'casual', 'very_casual', 'excited']);
  await queryInterface.addConstraint('style_profiles', {
    type: 'unique',
    fields: ['user_id', 'category'],
    name: 'uq_style_profiles_user_category',
  });
}

export async function down({ queryInterface }) {
  await queryInterface.dropTable('style_profiles');
  await queryInterface.dropTable('dictionary_entries');
}
