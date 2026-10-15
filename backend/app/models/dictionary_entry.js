// File: app/models/dictionary_entry.js
// Vocabulary words, misspelling corrections and snippets in one table
// (is_snippet distinguishes snippets).
//   vocabulary word:   phrase="Kubernetes",  replacement=null
//   correction:        phrase="couple",      replacement="Kapil"
//   snippet:           phrase="my calendar link", replacement="https://cal.com/...", is_snippet=true
import { DataTypes, Model } from 'sequelize';
import { DICTIONARY_SOURCES } from './constants.js';

export class DictionaryEntry extends Model {}

export function initDictionaryEntry(sequelize) {
  DictionaryEntry.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      user_id: { type: DataTypes.UUID, allowNull: false },
      phrase: { type: DataTypes.STRING(255), allowNull: false },
      replacement: { type: DataTypes.TEXT, allowNull: true },
      is_snippet: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      is_starred: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      source: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'manual', validate: { isIn: [DICTIONARY_SOURCES] } },
      frequency_used: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      last_used_at: { type: DataTypes.DATE, allowNull: true },
    },
    { sequelize, modelName: 'DictionaryEntry', tableName: 'dictionary_entries' },
  );
  return DictionaryEntry;
}
