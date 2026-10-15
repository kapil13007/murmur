// File: app/crud/dictionary_crud.js
// Vocabulary and snippets share this table; `isSnippet` selects the view.
import { Op, Sequelize } from 'sequelize';
import { DictionaryEntry } from '../models/index.js';

const SORTS = {
  newest: [['created_at', 'DESC']],
  oldest: [['created_at', 'ASC']],
  alphabetical: [[Sequelize.fn('lower', Sequelize.col('phrase')), 'ASC']],
  starred: [
    ['is_starred', 'DESC'],
    ['created_at', 'DESC'],
  ],
};

export function listEntries(userId, { isSnippet, search, sort = 'newest' }) {
  const where = { user_id: userId, is_snippet: isSnippet };
  if (search) {
    const pattern = `%${search.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    where[Op.and] = [{ [Op.or]: [{ phrase: { [Op.iLike]: pattern } }, { replacement: { [Op.iLike]: pattern } }] }];
  }
  return DictionaryEntry.findAll({ where, order: SORTS[sort] || SORTS.newest });
}

// Everything the formatter needs for one user in a single query.
export async function getFormattingEntries(userId) {
  const rows = await DictionaryEntry.findAll({
    where: { user_id: userId },
    attributes: ['id', 'phrase', 'replacement', 'is_snippet'],
    raw: true,
  });
  return {
    corrections: rows.filter((r) => !r.is_snippet && r.replacement),
    vocabulary: rows.filter((r) => !r.is_snippet && !r.replacement),
    snippets: rows.filter((r) => r.is_snippet && r.replacement),
  };
}

export function getOwnEntry(userId, id, isSnippet) {
  return DictionaryEntry.findOne({ where: { id, user_id: userId, is_snippet: isSnippet } });
}

export function findByPhrase(userId, phrase, isSnippet) {
  return DictionaryEntry.findOne({
    where: {
      user_id: userId,
      is_snippet: isSnippet,
      [Op.and]: [Sequelize.where(Sequelize.fn('lower', Sequelize.col('phrase')), phrase.trim().toLowerCase())],
    },
  });
}

export function createEntry(data, options = {}) {
  return DictionaryEntry.create(data, options);
}

export async function updateEntry(entry, data) {
  Object.assign(entry, data);
  await entry.save();
  return entry;
}

export function deleteEntries(ids, options = {}) {
  return DictionaryEntry.destroy({ where: { id: { [Op.in]: ids } }, ...options });
}

export function recordUsage(ids) {
  if (!ids.length) return Promise.resolve();
  return DictionaryEntry.update(
    { frequency_used: Sequelize.literal('frequency_used + 1'), last_used_at: new Date() },
    { where: { id: { [Op.in]: ids } }, silent: true },
  );
}

export function countEntries(userId, isSnippet) {
  return DictionaryEntry.count({ where: { user_id: userId, is_snippet: isSnippet } });
}
