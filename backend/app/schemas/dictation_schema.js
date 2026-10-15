// File: app/schemas/dictation_schema.js
// Multipart form fields that accompany an uploaded recording. Multer delivers
// every field as a string, hence the coercions.
import { z } from 'zod';
import { DICTATION_MODES } from '../models/constants.js';

const optionalText = (max) =>
  z
    .string()
    .max(max)
    .optional()
    .transform((v) => (v === undefined || v.trim() === '' ? null : v.trim()));

const optionalNumber = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => (v === undefined || v === '' ? null : Number(v)))
  .refine((v) => v === null || Number.isFinite(v), 'Must be a number');

export const DictationContext = z.object({
  mode: z.enum(DICTATION_MODES).default('push_to_talk'),
  app_name: optionalText(255),
  url: optionalText(512),
  window_title: optionalText(1000),
  // Accessible name of the focused text box ("To recipients", "Subject").
  field_name: optionalText(255),
  language: optionalText(10),
  device_uid: optionalText(100),
  mic_device: optionalText(255),
  app_version: optionalText(30),
  platform: optionalText(20),
  timezone_offset_minutes: optionalNumber,
  // Client-measured time from key release to upload start, for e2e latency.
  client_started_at: optionalText(40),
});

export const CommandContext = DictationContext.extend({
  selected_text: z.string().max(20_000).optional().default(''),
  // Text instruction, used instead of audio by the web hub's command box.
  instruction: z.string().max(2000).optional(),
});

export const FormatRequest = z.object({
  text: z.string().min(1).max(20_000),
  app_name: z.string().max(255).optional().nullable(),
  url: z.string().max(512).optional().nullable(),
  window_title: z.string().max(1000).optional().nullable(),
  field_name: z.string().max(255).optional().nullable(),
  style: z.enum(['formal', 'casual', 'very_casual', 'excited']).optional(),
  cleanup_level: z.enum(['none', 'light', 'medium', 'high']).optional(),
});
