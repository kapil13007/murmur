// File: app/models/constants.js
// Enumerations shared by models, request schemas and services. The database
// enforces the same values with CHECK constraints (see /migrations).

export const CLEANUP_LEVELS = ['none', 'light', 'medium', 'high'];
export const STYLES = ['formal', 'casual', 'very_casual', 'excited'];
export const STYLE_CATEGORIES = ['personal', 'work', 'email', 'other'];
export const DATA_RETENTION = ['store', 'auto_delete_24h', 'never_store'];
export const THEMES = ['light', 'dark', 'system'];

export const PLANS = { BASIC: 'FLOW_BASIC', PRO: 'FLOW_PRO', TEAMS: 'FLOW_TEAMS' };
export const SUBSCRIPTION_STATUSES = ['none', 'trialing', 'active', 'past_due', 'canceled'];

export const TRANSCRIPT_STATUSES = ['success', 'empty', 'no_audio', 'error', 'dismissed'];
export const DICTATION_MODES = ['push_to_talk', 'hands_free', 'command', 'web', 'retry'];

export const DICTIONARY_SOURCES = ['manual', 'auto_learned', 'import', 'default'];
export const NOTIFICATION_TYPES = ['milestone', 'tip', 'team', 'usage', 'feature', 'system', 'learning', 'billing'];

export const SHORTCUT_ACTIONS = ['push_to_talk', 'hands_free', 'command_mode', 'paste_last', 'copy_last', 'cancel'];

export const DEFAULT_SHORTCUTS = Object.freeze({
  push_to_talk: ['Ctrl', 'Win'],
  hands_free: ['Ctrl', 'Win', 'Space'],
  command_mode: ['Ctrl', 'Win', 'Alt'],
  paste_last: ['Shift', 'Alt', 'Z'],
  copy_last: ['Shift', 'Alt', 'X'],
  cancel: ['Esc'],
});

export const POLISH_INSTRUCTION_LABELS = Object.freeze({
  make_more_concise: 'Make more concise',
  clarify_main_point: 'Clarify main point',
  maintain_your_tone: 'Maintain your tone',
  reword_for_clarity: 'Reword for clarity',
  reorder_for_readability: 'Reorder for readability',
  refine_phrasing_for_impact: 'Refine phrasing for impact',
  add_structure_for_readability: 'Add structure for readability',
});

// Built-in style categories, mirroring Wispr Flow's default `userVoices`.
export const DEFAULT_STYLE_PROFILES = Object.freeze([
  { category: 'personal', name: 'Personal messages', app_names: ['WhatsApp', 'Messages', 'Telegram', 'Messenger', 'Signal', 'Discord'], style: 'casual' },
  { category: 'work', name: 'Work messages', app_names: ['Slack', 'Microsoft Teams', 'Google Chat', 'Zoom'], style: 'formal' },
  { category: 'email', name: 'Email', app_names: ['Gmail', 'Microsoft Outlook', 'Superhuman', 'Thunderbird', 'Mail'], style: 'formal' },
  { category: 'other', name: 'Other', app_names: [], style: 'formal' },
]);
