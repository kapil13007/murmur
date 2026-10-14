// File: app/services/formatting/index.js
// Turns a raw transcript into the text that gets pasted: AI cleanup (LLM when
// configured, rule engine otherwise), then the user's dictionary, snippets and
// email signature, which are always applied deterministically.
import { getLogger } from '../../core/logger.js';
import { complete, isLlmEnabled } from '../llm/index.js';
import { buildFormattingPrompt, stripWrappers } from '../llm/prompts.js';
import { applyCorrections, applyVocabulary, expandSnippets } from './dictionary.js';
import { applyRules, hasSignoff } from './rules.js';
import { countWords, normalizeWhitespace } from './text_utils.js';

const logger = getLogger('formatting');

// An LLM that answers the dictation instead of cleaning it produces far more
// words than were spoken; such output is discarded in favour of the rules.
function looksLikeAnAnswer(input, output) {
  const inWords = countWords(input);
  const outWords = countWords(output);
  return outWords > inWords * 1.8 + 25;
}

function appendSignature(text, ctx) {
  if (ctx.category !== 'email' || !ctx.emailAutoSignature) return text;
  if (hasSignoff(text)) return text;
  // Only sign things that read like an email, not a one-line search query.
  const looksLikeEmail = /^(hi|hey|hello|dear|good (morning|afternoon|evening))\b/i.test(text) || countWords(text) >= 25;
  if (!looksLikeEmail) return text;
  const signature = (ctx.emailSignature || `Best,\n${ctx.firstName || ''}`).trim();
  return signature ? `${text}\n\n${signature}` : text;
}

/**
 * @param {string} raw  ASR output
 * @param {object} ctx  { cleanupLevel, aiFormatting, smartFormatting, style, category, appName,
 *                        language, firstName, emailAutoSignature, emailSignature,
 *                        corrections, vocabulary, snippets }
 */
export async function formatTranscript(raw, ctx) {
  const started = Date.now();
  const english = !ctx.language || ctx.language.startsWith('en');
  const cleanup = ctx.aiFormatting === false ? 'none' : ctx.cleanupLevel || 'light';
  let text = normalizeWhitespace(raw);
  let formatter = cleanup === 'none' ? 'none' : 'rules';
  let model = null;

  if (text && cleanup !== 'none' && isLlmEnabled()) {
    try {
      const system = buildFormattingPrompt({
        cleanupLevel: cleanup,
        style: ctx.style,
        category: ctx.category,
        appName: ctx.appName,
        smartFormatting: ctx.smartFormatting,
        vocabulary: (ctx.vocabulary || []).map((v) => v.phrase),
        languageHint: ctx.language,
        firstName: ctx.firstName,
      });
      const result = await complete({ system, user: `<transcript>${text}</transcript>`, effort: 'low' });
      const cleaned = stripWrappers(result.text);
      if (!cleaned || result.truncated || looksLikeAnAnswer(text, cleaned)) {
        logger.warn('Discarded LLM formatting output; using rule-based cleanup');
      } else {
        text = cleaned;
        formatter = result.provider;
        model = result.model;
      }
    } catch (err) {
      logger.warn(`LLM formatting failed, using rule-based cleanup: ${err.message}`);
    }
  }

  if (formatter === 'rules' || formatter === 'none') {
    text = applyRules(text, {
      cleanupLevel: cleanup,
      smartFormatting: ctx.smartFormatting !== false,
      style: ctx.style || 'formal',
      category: ctx.category || 'other',
      english,
    });
  }

  const corrections = applyCorrections(text, ctx.corrections || []);
  const vocab = applyVocabulary(corrections.text, ctx.vocabulary || []);
  const snippets = expandSnippets(vocab.text, ctx.snippets || []);
  const finalText = cleanup === 'none' ? snippets.text : appendSignature(snippets.text, ctx);

  return {
    text: finalText,
    formatter,
    model,
    dictionaryReplacements: corrections.count + vocab.count,
    snippetsExpanded: snippets.count,
    usedEntryIds: new Set([...corrections.used, ...vocab.used, ...snippets.used]),
    latencyMs: Date.now() - started,
  };
}

export { applyRules } from './rules.js';
export { countWords } from './text_utils.js';
