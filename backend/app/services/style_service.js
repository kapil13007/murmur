// File: app/services/style_service.js
// Style page data. The example messages on each style card are produced by
// the real formatting engine, so the preview is exactly what dictation does.
import { applyRules } from './formatting/rules.js';
import { STYLES } from '../models/constants.js';

const EXAMPLES = {
  personal: "Hey, are you free for lunch tomorrow? Let's do 12 if that works for you.",
  work: "Hey team, I'll have the report ready by Friday. Let me know if you need anything else before then.",
  email: "Hi Alex, it was great talking with you today. Looking forward to our next chat. Best, Mary.",
  other: 'So far I am really enjoying this new app. It saves me so much time every day.',
};

const STYLE_META = {
  formal: { title: 'Formal.', subtitle: 'Caps + Punctuation' },
  casual: { title: 'Casual', subtitle: 'Caps + Less punctuation' },
  very_casual: { title: 'very casual', subtitle: 'No Caps + Less punctuation' },
  excited: { title: 'Excited!', subtitle: 'More exclamations' },
};

export function getStyleExamples() {
  const out = {};
  for (const [category, raw] of Object.entries(EXAMPLES)) {
    out[category] = STYLES.map((style) => ({
      style,
      ...STYLE_META[style],
      example: applyRules(raw, { cleanupLevel: 'light', style, category, smartFormatting: true }),
    }));
  }
  return out;
}

const CLEANUP_EXAMPLE = 'um hey joey, we still on for coffee or? I think uh we maybe should leave earlier to make it there in time, there might um be traffic. What are you thinking?';

export function getCleanupExamples() {
  return ['none', 'light', 'medium', 'high'].map((level) => ({
    level,
    example: applyRules(CLEANUP_EXAMPLE, { cleanupLevel: level, style: 'formal' }),
  }));
}
