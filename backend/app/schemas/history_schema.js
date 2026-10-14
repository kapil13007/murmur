// File: app/schemas/history_schema.js
import { z } from 'zod';
import { queryBool } from '../core/validators.js';

export const HistoryQuery = z.object({
  search: z.string().trim().max(200).optional(),
  archived: queryBool.optional().default(false),
  app: z.string().max(255).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  // Keyset pagination: ISO timestamp of the last row already shown.
  before: z.iso.datetime({ offset: true }).optional(),
});

export const UpdateTranscriptRequest = z
  .object({
    edited_text: z.string().max(20_000).nullable(),
    is_archived: z.boolean(),
    has_reverted_ai: z.boolean(),
    feedback: z.string().max(2000).nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export function toTranscriptOut(t, { includeAudioFlag = false } = {}) {
  const out = {
    id: t.id,
    status: t.status,
    mode: t.mode,
    text: t.displayText,
    asr_text: t.asr_text,
    formatted_text: t.formatted_text,
    edited_text: t.edited_text,
    app_name: t.app_name,
    app_category: t.app_category,
    url: t.url,
    window_title: t.window_title,
    language: t.language,
    num_words: t.num_words,
    duration_seconds: t.duration_seconds,
    asr_provider: t.asr_provider,
    asr_model: t.asr_model,
    formatter: t.formatter,
    llm_model: t.llm_model,
    asr_latency_ms: t.asr_latency_ms,
    format_latency_ms: t.format_latency_ms,
    e2e_latency_ms: t.e2e_latency_ms,
    personalization: t.personalization,
    num_dictionary_replacements: t.num_dictionary_replacements,
    num_snippets_expanded: t.num_snippets_expanded,
    mic_device: t.mic_device,
    is_archived: t.is_archived,
    has_reverted_ai: t.has_reverted_ai,
    feedback: t.feedback,
    error_message: t.error_message,
    created_at: t.created_at,
  };
  if (includeAudioFlag) out.has_audio = Boolean(t.get('has_audio'));
  return out;
}
