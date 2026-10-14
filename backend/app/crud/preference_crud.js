// File: app/crud/preference_crud.js
import { UserPreference } from '../models/index.js';
import { DEFAULT_SHORTCUTS, POLISH_INSTRUCTION_LABELS } from '../models/constants.js';

export const DEFAULT_POLISH = Object.freeze({
  make_more_concise: true,
  clarify_main_point: false,
  maintain_your_tone: true,
  reword_for_clarity: true,
  reorder_for_readability: true,
  refine_phrasing_for_impact: false,
  add_structure_for_readability: true,
});

export const DEFAULT_NOTIFICATION_SETTINGS = Object.freeze({
  tips_and_suggestions: true,
  feature_highlights: true,
  milestones_and_progress: true,
  team_updates: true,
});

export function createPreferences(userId, overrides = {}, options = {}) {
  return UserPreference.create(
    {
      user_id: userId,
      shortcuts: { ...DEFAULT_SHORTCUTS },
      polish_instructions: { ...DEFAULT_POLISH },
      notification_settings: { ...DEFAULT_NOTIFICATION_SETTINGS },
      ...overrides,
    },
    options,
  );
}

export async function getPreferences(userId, options = {}) {
  const prefs = await UserPreference.findByPk(userId, options);
  return prefs || createPreferences(userId, {}, options);
}

// JSON columns are merged so a partial update (one shortcut, one toggle)
// never wipes the rest of the object.
const MERGED_JSON = ['shortcuts', 'polish_instructions', 'notification_settings'];

export async function updatePreferences(prefs, changes, options = {}) {
  for (const [key, value] of Object.entries(changes)) {
    if (MERGED_JSON.includes(key) && value && typeof value === 'object') {
      const merged = { ...(prefs[key] || {}), ...value };
      // null removes an optional shortcut (e.g. clearing "copy last transcript").
      for (const [k, v] of Object.entries(merged)) if (v === null) delete merged[k];
      prefs.set(key, merged);
      prefs.changed(key, true);
    } else {
      prefs.set(key, value);
    }
  }
  await prefs.save(options);
  return prefs;
}

export const POLISH_KEYS = Object.keys(POLISH_INSTRUCTION_LABELS);
