// File: app/schemas/dictionary_schema.js
// Shared by the Dictionary (vocabulary) and Snippets endpoints, which are two
// views over the same `dictionary_entries` table.
import { z } from 'zod';

export const MAX_SNIPPET_EXPANSION = 4000;

const phrase = z.string().trim().min(1, 'Word cannot be empty').max(255);

export const ListEntriesQuery = z.object({
  search: z.string().trim().max(200).optional(),
  sort: z.enum(['newest', 'oldest', 'alphabetical', 'starred']).default('newest'),
});

export const CreateWordRequest = z.object({
  phrase,
  // Present when the user is correcting a misspelling ("Correct a misspelling").
  replacement: z.string().trim().max(255).optional().nullable(),
});

export const UpdateWordRequest = z
  .object({
    phrase,
    replacement: z.string().trim().max(255).nullable(),
    is_starred: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const CreateSnippetRequest = z.object({
  phrase,
  replacement: z
    .string()
    .min(1, 'Please enter a snippet and its expansion')
    .max(MAX_SNIPPET_EXPANSION, 'This expansion is too long. Please shorten it and try again.'),
});

export const UpdateSnippetRequest = z
  .object({
    phrase,
    replacement: z.string().min(1).max(MAX_SNIPPET_EXPANSION),
    is_starred: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const BulkIdsRequest = z.object({
  ids: z.array(z.uuid()).min(1).max(500),
});

export const ImportRequest = z.object({
  // One entry per line. "misspelling -> correction" / "trigger => expansion"
  // or CSV "phrase,replacement".
  text: z.string().min(1).max(200_000),
});

export function toEntryOut(entry) {
  return {
    id: entry.id,
    phrase: entry.phrase,
    replacement: entry.replacement,
    is_snippet: entry.is_snippet,
    is_starred: entry.is_starred,
    source: entry.source,
    frequency_used: entry.frequency_used,
    last_used_at: entry.last_used_at,
    created_at: entry.created_at,
    updated_at: entry.updated_at,
  };
}
