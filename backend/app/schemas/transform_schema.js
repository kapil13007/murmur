// File: app/schemas/transform_schema.js
import { z } from 'zod';

export const CreateTransformRequest = z.object({
  name: z.string().trim().min(1).max(100),
  instruction: z.string().trim().min(3).max(2000),
  icon: z.string().max(30).optional().nullable(),
});

export const UpdateTransformRequest = z
  .object({
    name: z.string().trim().min(1).max(100),
    instruction: z.string().trim().min(3).max(2000),
    icon: z.string().max(30).nullable(),
    is_enabled: z.boolean(),
    sort_order: z.number().int().min(0).max(1000),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const ApplyTransformRequest = z
  .object({
    text: z.string().min(1, 'There is no text to transform').max(20_000),
    transform_id: z.uuid().optional(),
    instruction: z.string().trim().min(1).max(2000).optional(),
    app_name: z.string().max(255).optional().nullable(),
  })
  .refine((v) => v.transform_id || v.instruction, 'Choose a transform or type an instruction');

export function toTransformOut(t) {
  return {
    id: t.id,
    name: t.name,
    instruction: t.instruction,
    icon: t.icon,
    is_builtin: t.is_builtin,
    is_enabled: t.is_enabled,
    sort_order: t.sort_order,
    created_at: t.created_at,
  };
}

export function toTransformRunOut(r) {
  return {
    id: r.id,
    transform_id: r.transform_id,
    transform_name: r.transform ? r.transform.name : null,
    instruction: r.instruction,
    input_text: r.input_text,
    output_text: r.output_text,
    input_word_count: r.input_word_count,
    output_word_count: r.output_word_count,
    status: r.status,
    provider: r.provider,
    model: r.model,
    processing_ms: r.processing_ms,
    is_undone: r.is_undone,
    created_at: r.created_at,
  };
}
