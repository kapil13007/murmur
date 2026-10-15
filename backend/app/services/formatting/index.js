// File: app/services/formatting/index.js
// Turns a raw transcript into the text that gets pasted: AI cleanup (LLM when
// configured, rule engine otherwise), then the user's dictionary, snippets and
// email signature, which are always applied deterministically, and a final
// pass that keeps addresses intact and fragments free of stray periods.
import { getLogger } from '../../core/logger.js';
import { complete, isLlmEnabled } from '../llm/index.js';
import { buildFormattingPrompt, stripWrappers } from '../llm/prompts.js';
import { endsWithAddress, formatAddressField, isAddressOnly, normalizeAddresses } from './addresses.js';
import { applyCorrections, applyVocabulary, expandSnippets } from './dictionary.js';
import { applyRules, dropFinalPeriod, ensureTerminalPunctuation, hasSignoff } from './rules.js';
import { countWords, normalizeWhitespace } from './text_utils.js';

const logger = getLogger('formatting');

// An LLM that answers the dictation instead of cleaning it produces far more
// words than were spoken; such output is discarded in favour of the rules.
function looksLikeAnAnswer(input, output) {
  const inWords = countWords(input);
  const outWords = countWords(output);
  return outWords > inWords * 1.8 + 25;
}

// "kapil dot sharma at gmail dot com", "kapil@gmail.com", "sam at acme.io"
const looksLikeSpokenAddress = (text) => /@|\bat\b.+(?:\bdot\b|\.)\s*\p{L}{2,}|\bdot\s+(?:com|org|net|io|in|co)\b/iu.test(text || '');

function appendSignature(text, ctx, field) {
  if (ctx.category !== 'email' || !ctx.emailAutoSignature || field !== 'text') return text;
  if (hasSignoff(text)) return text;
  // Only sign things that read like an email, not a one-line search query.
  const looksLikeEmail = /^(hi|hey|hello|dear|good (morning|afternoon|evening))\b/i.test(text) || countWords(text) >= 25;
  if (!looksLikeEmail) return text;
  const signature = (ctx.emailSignature || `Best,\n${ctx.firstName || ''}`).trim();
  return signature ? `${text}\n\n${signature}` : text;
}

/**
 * Last pass over every result, whichever formatter produced it:
 *  - addresses written the way they're typed (the dictionary or an LLM may
 *    have re-capitalised "kapil" inside "kapil@gmail.com"),
 *  - no period after a lone address, name or one/two-word fragment
 *    ("YouTube", "Kapil"), nor in one-line fields such as a subject or search,
 *  - otherwise the style's ending: Formal ends with a period, Casual and
 *    Very casual don't (LLMs follow this only most of the time).
 */
export function finalizeText(text, { field = 'text', style } = {}) {
  let t = normalizeAddresses(text);
  const stripPeriod = (s) => s.replace(/(?<!\.)\.$/, '');
  if (isAddressOnly(t) || endsWithAddress(stripPeriod(t))) return stripPeriod(t);
  if (field === 'short' || (countWords(t) <= 2 && !t.includes('\n'))) return stripPeriod(t);
  if (style === 'formal') t = ensureTerminalPunctuation(t, '.');
  else if (style === 'casual' || style === 'very_casual') t = dropFinalPeriod(t);
  return t;
}

/**
 * @param {string} raw  ASR output
 * @param {object} ctx  { cleanupLevel, aiFormatting, smartFormatting, style, category, field, appName,
 *                        language, firstName, lastName, emailAutoSignature, emailSignature,
 *                        corrections, vocabulary, snippets }
 */
export async function formatTranscript(raw, ctx) {
  const started = Date.now();
  const english = !ctx.language || ctx.language.startsWith('en');
  const cleanup = ctx.aiFormatting === false ? 'none' : ctx.cleanupLevel || 'light';
  let field = ctx.field || 'text';
  let text = normalizeWhitespace(raw);
  let formatter = cleanup === 'none' ? 'none' : 'rules';
  let model = null;

  // A To / Cc box takes addresses: fix the user's misheard words, then join
  // the address together, with no sentence formatting at all. Anything else
  // said there (a contact's name for autocomplete) is a one-line fragment.
  if (field === 'address' && !looksLikeSpokenAddress(text)) field = 'short';
  if (field === 'address' && text) {
    const corrections = applyCorrections(text, ctx.corrections || []);
    const vocab = applyVocabulary(corrections.text, ctx.vocabulary || []);
    return {
      text: formatAddressField(vocab.text),
      formatter: 'address',
      model,
      dictionaryReplacements: corrections.count + vocab.count,
      snippetsExpanded: 0,
      usedEntryIds: new Set([...corrections.used, ...vocab.used]),
      latencyMs: Date.now() - started,
    };
  }

  if (text && cleanup !== 'none' && isLlmEnabled()) {
    try {
      const system = buildFormattingPrompt({
        cleanupLevel: cleanup,
        style: ctx.style,
        category: ctx.category,
        field,
        appName: ctx.appName,
        smartFormatting: ctx.smartFormatting,
        vocabulary: [ctx.firstName, ctx.lastName, ...(ctx.vocabulary || []).map((v) => v.phrase)].filter(Boolean),
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
      // Subject lines and search boxes never get the email layout.
      category: field === 'text' ? ctx.category || 'other' : 'other',
      english,
    });
  }

  const corrections = applyCorrections(text, ctx.corrections || []);
  const vocab = applyVocabulary(corrections.text, ctx.vocabulary || []);
  const snippets = expandSnippets(vocab.text, ctx.snippets || []);
  const signed = cleanup === 'none' ? snippets.text : appendSignature(snippets.text, ctx, field);
  // The signature block ends with a name; it is never given a period.
  const finalText = cleanup === 'none' || signed !== snippets.text ? signed : finalizeText(signed, { field, style: ctx.style });

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
