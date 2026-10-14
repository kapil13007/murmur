// File: app/crud/note_crud.js
import { Op } from 'sequelize';
import { Note, NoteVersion } from '../models/index.js';

export const MAX_VERSIONS_PER_NOTE = 50;

export function listNotes(userId, { search } = {}) {
  const where = { user_id: userId };
  if (search) {
    const pattern = `%${search.toLowerCase().replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    where.searchable_content = { [Op.like]: pattern };
  }
  return Note.findAll({
    where,
    attributes: { exclude: ['content', 'searchable_content'] },
    order: [
      ['is_pinned', 'DESC'],
      ['updated_at', 'DESC'],
    ],
  });
}

export function getNote(userId, id) {
  return Note.findOne({ where: { id, user_id: userId } });
}

export function createNote(userId, data) {
  return Note.create({ ...data, user_id: userId });
}

export async function updateNote(note, data) {
  Object.assign(note, data);
  await note.save();
  return note;
}

export function deleteNote(userId, id) {
  return Note.destroy({ where: { id, user_id: userId } });
}

export async function createVersion(note, { source, transformPrompt = null }) {
  const version = await NoteVersion.create({
    note_id: note.id,
    title: note.title,
    content: note.content,
    source,
    transform_prompt: transformPrompt,
  });
  // Keep the history bounded: drop the oldest snapshots beyond the cap.
  const stale = await NoteVersion.findAll({
    where: { note_id: note.id },
    order: [['created_at', 'DESC']],
    offset: MAX_VERSIONS_PER_NOTE,
    attributes: ['id'],
  });
  if (stale.length) await NoteVersion.destroy({ where: { id: { [Op.in]: stale.map((v) => v.id) } } });
  return version;
}

export function listVersions(noteId) {
  return NoteVersion.findAll({ where: { note_id: noteId }, order: [['created_at', 'DESC']] });
}

export function getVersion(noteId, versionId) {
  return NoteVersion.findOne({ where: { id: versionId, note_id: noteId } });
}

export function getLatestVersion(noteId) {
  return NoteVersion.findOne({ where: { note_id: noteId }, order: [['created_at', 'DESC']] });
}
