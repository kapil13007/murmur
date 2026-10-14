// File: app/schemas/preference_schema.js
import { z } from 'zod';
import {
  CLEANUP_LEVELS,
  DATA_RETENTION,
  POLISH_INSTRUCTION_LABELS,
  SHORTCUT_ACTIONS,
  THEMES,
} from '../models/constants.js';

const KEY_NAMES = [
  'Ctrl', 'Alt', 'Shift', 'Win', 'Space', 'Esc', 'Tab', 'Enter', 'Backspace', 'CapsLock',
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
  ...'0123456789'.split(''),
  ...Array.from({ length: 24 }, (_, i) => `F${i + 1}`),
];

const combo = z
  .array(z.enum(KEY_NAMES))
  .min(1)
  .max(4)
  .refine((keys) => new Set(keys).size === keys.length, 'A shortcut cannot repeat a key');

const shortcutsSchema = z
  .object(Object.fromEntries(SHORTCUT_ACTIONS.map((action) => [action, combo.nullable().optional()])))
  .refine((s) => s.push_to_talk !== null, 'Push to talk needs a shortcut')
  .refine((s) => {
    const seen = new Set();
    for (const keys of Object.values(s)) {
      if (!keys) continue;
      const id = [...keys].sort().join('+');
      if (seen.has(id)) return false;
      seen.add(id);
    }
    return true;
  }, 'Two actions cannot share the same shortcut');

const polishSchema = z.object(
  Object.fromEntries(Object.keys(POLISH_INSTRUCTION_LABELS).map((k) => [k, z.boolean().optional()])),
);

const notificationSchema = z.object({
  tips_and_suggestions: z.boolean().optional(),
  feature_highlights: z.boolean().optional(),
  milestones_and_progress: z.boolean().optional(),
  team_updates: z.boolean().optional(),
});

export const UpdatePreferencesRequest = z
  .object({
    ai_formatting: z.boolean(),
    auto_cleanup_level: z.enum(CLEANUP_LEVELS),
    smart_formatting: z.boolean(),
    selected_languages: z.array(z.string().min(2).max(10)).max(10),
    ui_locale: z.string().min(2).max(10),
    timezone: z.string().min(1).max(64),
    microphone_device_id: z.string().max(500).nullable(),
    microphone_label: z.string().max(500).nullable(),
    shortcuts: shortcutsSchema,
    enable_sounds: z.boolean(),
    mute_audio_while_dictating: z.boolean(),
    open_at_login: z.boolean(),
    show_flow_bar: z.boolean(),
    show_in_taskbar: z.boolean(),
    auto_add_to_dictionary: z.boolean(),
    context_awareness: z.boolean(),
    command_mode_enabled: z.boolean(),
    email_auto_signature: z.boolean(),
    email_signature: z.string().max(500).nullable(),
    polish_instructions: polishSchema,
    privacy_mode: z.boolean(),
    data_retention: z.enum(DATA_RETENTION),
    notification_settings: notificationSchema,
    theme: z.enum(THEMES),
    dictionary_sort: z.enum(['newest', 'oldest', 'alphabetical', 'starred']),
    notes_view: z.enum(['grid', 'list']),
    flow_bar_position: z.enum(['bottom', 'top']),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export function toPreferencesOut(prefs) {
  const out = prefs.get({ plain: true });
  delete out.user_id;
  return out;
}
