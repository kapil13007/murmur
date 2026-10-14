// File: app/schemas/note_schema.js
import { z } from 'zod';

const MAX_NOTE = 200_000;

export const ListNotesQuery = z.object({
  search: z.string().trim().max(200).optional(),
});

export const CreateNoteRequest = z.object({
  title: z.string().max(255).default(''),
  content: z.string().max(MAX_NOTE).default(''),
  source: z.enum(['typed', 'dictated']).default('typed'),
});

export const UpdateNoteRequest = z
  .object({
    title: z.string().max(255),
    content: z.string().max(MAX_NOTE),
    is_pinned: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const TransformNoteRequest = z
  .object({
    transform_id: z.uuid().optional(),
    instruction: z.string().trim().min(1).max(2000).optional(),
  })
  .refine((v) => v.transform_id || v.instruction, 'Choose a transform or type an instruction');

export const VersionParams = z.object({ id: z.uuid(), versionId: z.uuid() });

export function toNoteOut(note, { full = true } = {}) {
  const out = {
    id: note.id,
    title: note.title,
    content_preview: note.content_preview,
    is_pinned: note.is_pinned,
    source: note.source,
    created_at: note.created_at,
    updated_at: note.updated_at,
  };
  if (full) out.content = note.content;
  return out;
}

export function toNoteVersionOut(v) {
  return {
    id: v.id,
    note_id: v.note_id,
    title: v.title,
    content: v.content,
    source: v.source,
    transform_prompt: v.transform_prompt,
    created_at: v.created_at,
  };
}
