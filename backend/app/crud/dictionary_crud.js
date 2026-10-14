// File: app/crud/dictionary_crud.js
// Vocabulary and snippets share this table; `isSnippet` selects the view.
import { Op, Sequelize } from 'sequelize';
import { DictionaryEntry, User } from '../models/index.js';

function visibleWhere(userId, teamId, isSnippet) {
  const scopes = [{ user_id: userId }];
  if (teamId) scopes.push({ team_id: teamId });
  return { is_snippet: isSnippet, [Op.or]: scopes };
}

const SORTS = {
  newest: [['created_at', 'DESC']],
  oldest: [['created_at', 'ASC']],
  alphabetical: [[Sequelize.fn('lower', Sequelize.col('phrase')), 'ASC']],
  starred: [
    ['is_starred', 'DESC'],
    ['created_at', 'DESC'],
  ],
};

export function listEntries(userId, teamId, { isSnippet, search, scope = 'all', sort = 'newest' }) {
  const where = visibleWhere(userId, teamId, isSnippet);
  if (scope === 'personal') {
    delete where[Op.or];
    where.user_id = userId;
    where.team_id = null;
  } else if (scope === 'team') {
    delete where[Op.or];
    where.team_id = teamId || '00000000-0000-0000-0000-000000000000';
  }
  if (search) {
    const pattern = `%${search.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    where[Op.and] = [{ [Op.or]: [{ phrase: { [Op.iLike]: pattern } }, { replacement: { [Op.iLike]: pattern } }] }];
  }
  return DictionaryEntry.findAll({
    where,
    include: [{ model: User, as: 'owner', attributes: ['id', 'first_name', 'last_name'] }],
    order: SORTS[sort] || SORTS.newest,
  });
}

// Everything the formatter needs for one user in a single query.
export async function getFormattingEntries(userId, teamId) {
  const scopes = [{ user_id: userId }];
  if (teamId) scopes.push({ team_id: teamId });
  const rows = await DictionaryEntry.findAll({
    where: { [Op.or]: scopes },
    attributes: ['id', 'phrase', 'replacement', 'is_snippet'],
    raw: true,
  });
  return {
    corrections: rows.filter((r) => !r.is_snippet && r.replacement),
    vocabulary: rows.filter((r) => !r.is_snippet && !r.replacement),
    snippets: rows.filter((r) => r.is_snippet && r.replacement),
  };
}

export function getVisibleEntry(userId, teamId, id, isSnippet) {
  return DictionaryEntry.findOne({ where: { id, ...visibleWhere(userId, teamId, isSnippet) } });
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
