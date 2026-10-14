// File: app/services/note_service.js
// Scratchpad notes with automatic version snapshots, AI transforms and
// restore (Wispr's Notes + NoteVersions).
import { notFound } from '../core/errors.js';
import {
  createNote,
  createVersion,
  deleteNote,
  getLatestVersion,
  getNote,
  getVersion,
  listNotes,
  listVersions,
  updateNote,
} from '../crud/note_crud.js';
import { toNoteOut, toNoteVersionOut } from '../schemas/note_schema.js';
import { publish } from './realtime_service.js';
import { applyTransform } from './transform_service.js';

// Autosave fires every few seconds while typing; a restorable snapshot of the
// previous content is kept at most once per window.
const SNAPSHOT_WINDOW_MS = 5 * 60_000;

async function requireNote(userId, id) {
  const note = await getNote(userId, id);
  if (!note) throw notFound('Note not found');
  return note;
}


export async function getNotes(userId, query) {
  return (await listNotes(userId, query)).map((n) => toNoteOut(n, { full: false }));
}

export async function getNoteDetail(userId, id) {
  return toNoteOut(await requireNote(userId, id));
}

// A quick note's first line becomes its title (and isn't repeated in the
// body); a single-line note keeps its text as the body and stays untitled.
function splitTitle(content) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const first = lines[0].trim();
  if (lines.length > 1 && first && first.length <= 80) {
    return { title: first.replace(/^#+\s*/, ''), content: lines.slice(1).join('\n').replace(/^\n+/, '') };
  }
  return { title: '', content };
}

export async function addNote(userId, data) {
  const fields = data.title ? data : { ...data, ...splitTitle(data.content || '') };
  const note = await createNote(userId, fields);
  publish(userId, 'notes.changed', { id: note.id });
  return toNoteOut(note);
}

export async function editNote(userId, id, changes) {
  const note = await requireNote(userId, id);
  const contentChanging = changes.content !== undefined && changes.content !== note.content;
  if (contentChanging && note.content.trim()) {
    const latest = await getLatestVersion(note.id);
    if (!latest || Date.now() - latest.created_at.getTime() > SNAPSHOT_WINDOW_MS) {
      await createVersion(note, { source: 'snapshot' });
    }
  }
  await updateNote(note, changes);
  publish(userId, 'notes.changed', { id: note.id });
  return toNoteOut(note);
}

export async function removeNote(userId, id) {
  await requireNote(userId, id);
  await deleteNote(userId, id);
  publish(userId, 'notes.changed', { id });
}

export async function getNoteVersions(userId, id) {
  await requireNote(userId, id);
  return (await listVersions(id)).map(toNoteVersionOut);
}

export async function restoreNoteVersion(userId, id, versionId) {
  const note = await requireNote(userId, id);
  const version = await getVersion(note.id, versionId);
  if (!version) throw notFound('Version not found');
  await createVersion(note, { source: 'restore' });
  await updateNote(note, { title: version.title, content: version.content });
  publish(userId, 'notes.changed', { id: note.id });
  return toNoteOut(note);
}

export async function transformNote(userId, id, { transform_id, instruction }) {
  const note = await requireNote(userId, id);
  const run = await applyTransform(userId, { text: note.content, transform_id, instruction }, { noteId: note.id });
  if (run.status === 'success') {
    // Keep the pre-transform text restorable.
    await createVersion(note, { source: 'transform', transformPrompt: run.instruction });
    await updateNote(note, { content: run.output_text });
    publish(userId, 'notes.changed', { id: note.id });
  }
  return { note: toNoteOut(note), run };
}
