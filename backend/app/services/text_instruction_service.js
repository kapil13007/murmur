// File: app/services/text_instruction_service.js
// Executes a natural-language instruction against some text. Shared by
// Command Mode (spoken instruction on selected text) and Transforms. Uses the
// LLM when configured; otherwise a set of rule-based instructions covers the
// common cases (tone, cleanup, lists, case, summaries).
import { HttpError } from '../core/errors.js';
import { complete, isLlmEnabled, LlmRefusalError } from './llm/index.js';
import { buildCommandPrompt, buildTransformPrompt, stripWrappers } from './llm/prompts.js';
import { applyRules } from './formatting/rules.js';
import { COMMON_WORDS, capitalizeFirst } from './formatting/text_utils.js';

function sentencesOf(text) {
  return (text.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]*/g) || []).map((s) => s.trim()).filter(Boolean);
}

// Classic frequency-based extractive summary: keeps the highest-scoring
// sentences in their original order.
export function extractiveSummary(text, maxSentences = 2) {
  const sentences = sentencesOf(text);
  if (sentences.length <= maxSentences) return sentences.join(' ');
  const freq = new Map();
  for (const word of text.toLowerCase().match(/\p{L}+/gu) || []) {
    if (!COMMON_WORDS.has(word) && word.length > 2) freq.set(word, (freq.get(word) || 0) + 1);
  }
  const scored = sentences.map((s, index) => {
    const words = s.toLowerCase().match(/\p{L}+/gu) || [];
    const score = words.reduce((sum, w) => sum + (freq.get(w) || 0), 0) / Math.sqrt(words.length || 1);
    return { s, index, score };
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSentences)
    .sort((a, b) => a.index - b.index)
    .map((x) => x.s)
    .join(' ');
}

// One item per line (and per sentence within a line), with list markers and
// filler words stripped from each item.
function toBullets(text, numbered) {
  const items = text
    .split(/\n+/)
    .flatMap((line) => sentencesOf(line))
    .map((s) => s.replace(/^\s*(?:[-*•]|\d+[.)]|bullet(?:\s+point)?[,:]?)\s+/i, ''))
    .map((s) => applyRules(s, { cleanupLevel: 'light', style: 'casual', smartFormatting: false }))
    .map((s) => s.replace(/\bbullet point\b/gi, '').replace(/[.]+$/, '').trim())
    .filter(Boolean);
  return items.map((s, i) => `${numbered ? `${i + 1}.` : '-'} ${capitalizeFirst(s)}`).join('\n');
}

const titleCase = (text) => text.toLowerCase().replace(/\b(\p{L})(\p{L}*)/gu, (m, a, b) => a.toUpperCase() + b);

// Returns transformed text, or null when the instruction needs a real LLM.
export function applyLocalInstruction(instruction, text) {
  const i = instruction.toLowerCase();
  if (/\b(upper ?case|all caps|capital letters)\b/.test(i)) return text.toUpperCase();
  if (/\blower ?case\b/.test(i)) return text.toLowerCase();
  if (/\btitle ?case\b/.test(i)) return titleCase(text);
  if (/\bnumbered\b/.test(i) && /\blist\b/.test(i)) return toBullets(text, true);
  if (/\b(bullet|bulleted|bullets)\b|\b(make|turn) (it|this|that) into a list\b/.test(i)) return toBullets(text, false);
  if (/\b(summari[sz]e|summary|tl;?dr)\b/.test(i)) return extractiveSummary(text, 2);
  if (/\b(concise|shorter|shorten|brief|trim)\b/.test(i)) return applyRules(text, { cleanupLevel: 'high', style: 'formal' });
  if (/\b(excited|enthusiastic|energetic)\b/.test(i)) return applyRules(text, { cleanupLevel: 'medium', style: 'excited' });
  if (/\b(casual|friendly|informal|relaxed)\b/.test(i)) return applyRules(text, { cleanupLevel: 'medium', style: 'casual' });
  if (/\b(formal|professional)\b/.test(i)) return applyRules(text, { cleanupLevel: 'medium', style: 'formal' });
  if (/\b(polish|grammar|spelling|punctuation|clean (it|this|that)? ?up|fix|filler)\b/.test(i)) {
    return applyRules(text, { cleanupLevel: 'medium', style: 'formal' });
  }
  return null;
}

/**
 * @param {object} p
 * @param {'command'|'transform'} p.purpose
 * @param {string} p.instruction
 * @param {string} p.text          selected text / text to transform ('' = none)
 * @param {string} [p.appName]
 * @param {string} [p.llmInstruction]  overrides the instruction sent to the LLM (Polish)
 */
export async function runTextInstruction({ purpose, instruction, text, appName, llmInstruction }) {
  const started = Date.now();
  const hasText = Boolean(text && text.trim());
  if (isLlmEnabled()) {
    try {
      const effectiveInstruction = llmInstruction || instruction;
      const system =
        purpose === 'command'
          ? buildCommandPrompt({ appName, hasSelection: hasText })
          : buildTransformPrompt({ instruction: effectiveInstruction });
      const user =
        purpose === 'command'
          ? `<instruction>${effectiveInstruction}</instruction>${hasText ? `\n<selected_text>${text}</selected_text>` : ''}`
          : `<text>${text}</text>`;
      const result = await complete({ system, user, effort: 'medium' });
      const output = stripWrappers(result.text);
      if (!output) throw new HttpError(502, 'The AI returned an empty response. Please try again.');
      return { output, provider: result.provider, model: result.model, processing_ms: Date.now() - started };
    } catch (err) {
      if (err instanceof HttpError) throw err;
      if (err instanceof LlmRefusalError) throw new HttpError(422, 'The AI declined this request.', { code: 'llm_refused' });
      // Fall through to the offline rules when the provider is down.
      const local = hasText ? applyLocalInstruction(instruction, text) : null;
      if (local === null) throw new HttpError(503, `The AI provider is unavailable: ${err.message}`, { code: 'llm_unavailable' });
      return { output: local, provider: 'rules', model: null, processing_ms: Date.now() - started };
    }
  }
  const local = hasText ? applyLocalInstruction(instruction, text) : null;
  if (local === null) {
    throw new HttpError(
      503,
      'This instruction needs an AI provider. Set LLM_PROVIDER and an API key in backend/.env to enable it.',
      { code: 'llm_required' },
    );
  }
  return { output: local, provider: 'rules', model: null, processing_ms: Date.now() - started };
}
