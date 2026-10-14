// File: app/services/formatting/rules.js
// Deterministic, offline transcript cleanup. Used on its own when no LLM is
// configured, and as the fallback when the LLM is slow or unavailable.
//
// Pipeline (see applyRules): spoken commands -> times -> fillers -> stutters
// -> self-corrections -> lists -> punctuation -> capitalisation -> style
// -> email layout.
import { COMMON_WORDS, capitalizeFirst, normalizeWhitespace, squash } from './text_utils.js';

// ---------------------------------------------------------------------------
// Spoken commands: "new line", "new paragraph", "question mark", ...
// ---------------------------------------------------------------------------
const DETERMINERS = new Set(['a', 'an', 'the', 'this', 'that', 'another', 'one', 'each', 'every', 'my', 'your', 'our']);

function replaceCommand(text, phrase, replacement) {
  const re = new RegExp(String.raw`[ \t]*[,.;:]?[ \t]*\b(${phrase})\b[,.;:!?]?[ \t]*`, 'gi');
  return text.replace(re, (match, cmd, offset, whole) => {
    // "a new line of credit" / "the question mark" are words, not commands.
    const before = whole.slice(0, offset).trim().split(/\s+/).pop() || '';
    if (DETERMINERS.has(before.toLowerCase().replace(/[^a-z]/g, ''))) return match;
    return typeof replacement === 'function' ? replacement(match) : replacement;
  });
}

export function applySpokenCommands(text) {
  let t = text;
  t = replaceCommand(t, '(?:new|next) paragraph', '\n\n');
  t = replaceCommand(t, 'new line', '\n');
  t = replaceCommand(t, 'question mark', '? ');
  t = replaceCommand(t, 'exclamation (?:mark|point)', '! ');
  t = replaceCommand(t, 'full stop', '. ');
  // A lone "period" is only a command at the very end of the dictation.
  t = t.replace(/[ \t]*[,.]?[ \t]*\bperiod\.?\s*$/i, '.');
  t = t.replace(/\b(?:open|begin) quote\b[,.]?\s*/gi, '"');
  t = t.replace(/[ \t]*[,.]?[ \t]*\b(?:close|end) quote\b/gi, '"');
  return t.replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n');
}

// ---------------------------------------------------------------------------
// Times: "4 p.m." / "4pm" -> "4 PM" (also prevents "p.m. Tomorrow" capitalisation)
// ---------------------------------------------------------------------------
export function normalizeTimes(text) {
  return text.replace(/\b(\d{1,2})(?::(\d{2}))?\s?([ap])\.?\s?m\b(\.?)/gi, (m, h, mm, ap, dot, offset, whole) => {
    const rest = whole.slice(offset + m.length);
    // Keep the period when it also ended the sentence.
    const endsSentence = dot && (/^\s*$/.test(rest) || /^\s+[A-Z\n]/.test(rest));
    return `${h}${mm ? `:${mm}` : ''} ${ap.toUpperCase()}M${endsSentence ? '.' : ''}`;
  });
}

// ---------------------------------------------------------------------------
// Filler words
// ---------------------------------------------------------------------------
const FILLERS = new Set(['um', 'umm', 'ummm', 'uh', 'uhh', 'uhhh', 'uhm', 'erm', 'er', 'err', 'ehm', 'mm', 'mmm', 'hmm', 'hmmm']);

function stripFillersInLine(line) {
  const tokens = line.split(' ').filter(Boolean);
  const out = [];
  tokens.forEach((tok, i) => {
    const m = tok.match(/^(["'(]*)(\p{L}+)([^\p{L}\p{N}]*)$/u);
    if (!m || !FILLERS.has(m[2].toLowerCase())) {
      out.push(tok);
      return;
    }
    const trailing = m[3];
    const prevIdx = out.length - 1;
    const prev = prevIdx >= 0 ? out[prevIdx] : null;
    const isEllipsis = /\.\.\.|…/.test(trailing);
    if (/[.!?]/.test(trailing) && !isEllipsis) {
      // "I think, uh." -> "I think."
      if (prev !== null && !/[.!?]$/.test(prev)) out[prevIdx] = prev.replace(/[,;:]+$/, '') + trailing.replace(/[^.!?]/g, '').slice(0, 1);
    } else if (prev !== null && /,$/.test(prev) && (/[,…]|\.\.\./.test(trailing) || i === tokens.length - 1)) {
      // "should, uh, meet" -> "should meet"; trailing ", uh" -> ""
      out[prevIdx] = prev.replace(/,+$/, '');
    }
  });
  return out.join(' ');
}

export function stripFillers(text) {
  return text.split('\n').map(stripFillersInLine).join('\n');
}

// Multi-word / discourse fillers, removed from "medium" cleanup upwards.
export function stripPhraseFillers(text, level) {
  let t = text;
  const sentenceStart = String.raw`(^|[.!?]\s+|\n)`;
  const starters = level === 'high'
    ? '(?:you know|i mean|like|basically|well|so|okay so|ok so|anyway|honestly|literally|actually)'
    : '(?:you know|i mean|like|basically|well|so|okay so|ok so|anyway)';
  // Repeat: fillers stack up ("So, you know, I think ...").
  const starterRe = new RegExp(`${sentenceStart}${starters},\\s+`, 'gi');
  for (let i = 0; i < 4; i++) {
    const next = t.replace(starterRe, '$1');
    if (next === t) break;
    t = next;
  }
  t = t.replace(/,\s*(?:you know|i mean|like|basically)\s*,\s*/gi, ' ');
  t = t.replace(/,\s*(?:you know|i mean)(?=[.!?]|$)/gim, '');
  // "we should like ship it" (but not "would like to", "should like it").
  t = t.replace(/\b(should|could|might|must|gonna|just)\s+like\s+(?!to\b|it\b|that\b|this\b|them\b|him\b|her\b|you\b|me\b|us\b)/gi, '$1 ');
  if (level === 'high') {
    t = t.replace(/\b(is|was|are|were|it's|i'm|that's|we're|they're|am|seems)\s+(?:kind of|sort of|kinda|sorta)\s+/gi, '$1 ');
    t = t.replace(/\b(?:basically|literally|honestly),?\s+/gi, '');
  }
  return t;
}

// ---------------------------------------------------------------------------
// Stutters and false starts: "I- I think", "the the", "we, we"
// ---------------------------------------------------------------------------
const STUTTER_WORDS = new Set([
  'i', 'the', 'a', 'an', 'to', 'and', 'but', 'so', 'we', 'you', 'it', 'in', 'on', 'of', 'for', 'my', 'is', 'this',
  'he', 'she', 'they', 'was', 'be', 'are', 'can', 'will', 'with', 'at', 'if', 'or', 'me', 'our', 'your', 'just',
]);

export function removeStutters(text) {
  let t = text.replace(/\b(\p{L}+)-\s+\1\b/giu, '$1');
  t = t.replace(/\b(\p{L}+)(?:\s+\1\b)+/giu, (m, w) => (STUTTER_WORDS.has(w.toLowerCase()) ? w : m));
  t = t.replace(/\b(\p{L}+),\s+\1\b/giu, (m, w) => (STUTTER_WORDS.has(w.toLowerCase()) ? w : m));
  return t;
}

// ---------------------------------------------------------------------------
// Self-corrections ("backtracking")
// ---------------------------------------------------------------------------
const VALUE_TYPES = [
  ['time', String.raw`\d{1,2}(?::\d{2})?\s?[AP]M|noon|midnight`],
  ['weekday', 'monday|tuesday|wednesday|thursday|friday|saturday|sunday'],
  ['relday', 'today|tomorrow|tonight|yesterday'],
  ['month', String.raw`(?:january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+\d{1,2}(?:st|nd|rd|th)?)?`],
  ['number', String.raw`\$?\d+(?:[.,]\d+)?%?`],
];
const CUES = String.raw`(?:no,?\s+wait|wait,?\s+no|no|sorry|actually|i mean|or rather|wait|make that|make it|i meant)`;
const INTERJECTIONS = new Set(['actually', 'no', 'oh', 'wait', 'sorry', 'okay', 'ok', 'um', 'uh', 'oops', 'so', 'well']);

// Splits into sentences and newline runs, keeping every character: a line
// without terminal punctuation still ends at its newline.
function splitSentences(text) {
  const parts = [];
  const re = /[^.!?\n]+(?:[.!?]+["')]*|(?=\n)|$)|[.!?]+|\n+/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m[0] === '') {
      re.lastIndex++;
      continue;
    }
    parts.push(m[0]);
  }
  return parts;
}

function joinSentences(parts) {
  return parts
    .map((p) => (/^\n+$/.test(p) ? p : p.trim()))
    .filter((p) => p.length)
    .join(' ')
    .replace(/ ?(\n+) ?/g, '$1')
    .trim();
}

// "at 3 PM, no wait, 4 PM" -> "at 4 PM"
function applyInlineCorrections(text) {
  let t = text;
  for (const [, pattern] of VALUE_TYPES) {
    const re = new RegExp(String.raw`\b(${pattern})(\s*[,.]?\s*${CUES}[,.]?\s+)(${pattern})\b`, 'gi');
    t = t.replace(re, (m, first, cue, second) => second);
  }
  return t;
}

// "...meet at 3 PM to review. Actually, let's do 4 PM instead." -> "...meet at 4 PM to review."
function applySentenceCorrections(text) {
  const sentences = splitSentences(text);
  const anyValue = VALUE_TYPES.map(([, p]) => `(?:${p})`).join('|');
  const followUp = new RegExp(
    String.raw`^\s*(?:actually|no|sorry|wait|oh|oops)[,!]?\s+(?:no[,!]?\s+)?(?:let's|let us|make it|make that|change it to|change that to|i meant|it should be|it's|we'll do|how about|do)?\s*(?:do\s+)?(${anyValue})(?:\s+instead)?\s*[.!]?\s*$`,
    'i',
  );
  for (let k = 1; k < sentences.length; k++) {
    const m = sentences[k].match(followUp);
    if (!m) continue;
    const value = m[1];
    const type = VALUE_TYPES.find(([, p]) => new RegExp(`^(?:${p})$`, 'i').test(value));
    if (!type) continue;
    let prevIndex = k - 1;
    while (prevIndex >= 0 && /^\n+$/.test(sentences[prevIndex])) prevIndex--;
    if (prevIndex < 0) continue;
    const re = new RegExp(String.raw`\b(?:${type[1]})\b`, 'gi');
    const prev = sentences[prevIndex];
    const hits = [...prev.matchAll(re)];
    if (!hits.length) continue;
    const last = hits[hits.length - 1];
    sentences[prevIndex] = prev.slice(0, last.index) + value + prev.slice(last.index + last[0].length);
    sentences[k] = '';
  }
  return joinSentences(sentences);
}

// "Send it today. Actually, scratch that. Send it tomorrow." -> "Send it tomorrow."
function applyScratchThat(text) {
  const cmd = /\b(?:scratch that|strike that|delete that|cancel that|never ?mind that|forget that)\b[.,!]?\s*/i;
  let t = text;
  for (let guard = 0; guard < 10; guard++) {
    const m = cmd.exec(t);
    if (!m) break;
    const before = t.slice(0, m.index);
    const after = t.slice(m.index + m[0].length);
    const sentences = splitSentences(before);
    const current = sentences.length && !/[.!?\n]\s*$/.test(before) ? sentences.pop() : '';
    const currentWords = current.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
    if (currentWords.every((w) => INTERJECTIONS.has(w))) {
      // The command stands alone, so it deletes the previous sentence.
      while (sentences.length && /^\n+$/.test(sentences[sentences.length - 1])) sentences.pop();
      sentences.pop();
    }
    t = `${joinSentences(sentences)} ${after}`.trim();
  }
  return t;
}

export function applyBacktracking(text) {
  return applySentenceCorrections(applyInlineCorrections(applyScratchThat(text)));
}

// ---------------------------------------------------------------------------
// Lists: "my priorities are 1. fix the bug, 2. write tests, 3. deploy"
// ---------------------------------------------------------------------------
const NUMBER_WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const ORDINAL_WORDS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];

const LIST_STYLES = [
  // "1. foo 2. bar" (explicit list punctuation)
  { re: /(?:^|(?<=[\s:,;]))(?:number\s+)?(\d{1,2})[.)]\s+/g, value: (m) => Number(m[1]), min: 2, ordered: true },
  // "number one foo number two bar"
  { re: /(?:^|(?<=[\s:,;.]))number\s+(one|two|three|four|five|six|seven|eight|nine|ten)[,.:]?\s+/gi, value: (m) => NUMBER_WORDS.indexOf(m[1].toLowerCase()) + 1, min: 2, ordered: true },
  // "...: one, foo, two, bar, three, baz" (markers must follow punctuation)
  { re: /(?:^|(?<=[:,;.]\s))(one|two|three|four|five|six|seven|eight|nine|ten)[,.:]\s+/gi, value: (m) => NUMBER_WORDS.indexOf(m[1].toLowerCase()) + 1, min: 3, ordered: true },
  // "First, foo. Second, bar. Third, baz."
  { re: /(?:^|(?<=[:,;.]\s))(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)(?:ly)?,\s+/gi, value: (m) => ORDINAL_WORDS.indexOf(m[1].toLowerCase()) + 1, min: 3, ordered: true },
  // "bullet point foo bullet point bar"
  { re: /(?:^|(?<=[\s:,;.]))bullet(?:\s+point)?[,:]?\s+/gi, value: () => null, min: 2, ordered: false },
];

function cleanItem(item, isLast) {
  let s = item.trim().replace(/^[,;:\s]+/, '');
  s = s.replace(/[,;]\s*(?:and|or)?\s*$/i, '').replace(/\s+(?:and|or)$/i, '');
  if (!isLast) s = s.replace(/[.]+$/, '');
  return capitalizeFirst(s.trim());
}

function findListRun(line, style) {
  const markers = [...line.matchAll(style.re)].map((m) => ({ start: m.index, end: m.index + m[0].length, value: style.value(m) }));
  if (markers.length < style.min) return null;
  if (!style.ordered) return markers;
  // Longest consecutive run 1, 2, 3, ...
  let best = null;
  for (let i = 0; i < markers.length; i++) {
    if (markers[i].value !== 1) continue;
    const run = [markers[i]];
    for (let j = i + 1; j < markers.length && run.length < 10; j++) {
      if (markers[j].value === run.length + 1) run.push(markers[j]);
    }
    if (!best || run.length > best.length) best = run;
  }
  return best && best.length >= style.min ? best : null;
}

function formatListInLine(line) {
  for (const style of LIST_STYLES) {
    const run = findListRun(line, style);
    if (!run) continue;
    const intro = line.slice(0, run[0].start).trim().replace(/[,;]$/, '');
    const items = run.map((marker, i) => line.slice(marker.end, i + 1 < run.length ? run[i + 1].start : line.length));
    if (items.some((item) => !squash(item))) continue;

    // Text after the final item's first sentence ending becomes an outro.
    let outro = '';
    const lastItem = items[items.length - 1];
    const split = lastItem.match(/^(.*?[.!?])\s+(\S.*)$/s);
    if (split) {
      items[items.length - 1] = split[1];
      outro = split[2];
    }
    const lines = items.map((item, i) => {
      const text = cleanItem(item, false).replace(/[.]+$/, '');
      return style.ordered ? `${i + 1}. ${text}` : `- ${text}`;
    });
    const head = intro ? `${capitalizeFirst(intro.replace(/[.:]+$/, ''))}:\n` : '';
    return `${head}${lines.join('\n')}${outro ? `\n\n${outro}` : ''}`;
  }
  return line;
}

export function formatLists(text) {
  return text.split('\n').map(formatListInLine).join('\n');
}

// ---------------------------------------------------------------------------
// Punctuation and capitalisation
// ---------------------------------------------------------------------------
export function tidyPunctuation(text) {
  return text
    .replace(/[ \t]+([,.;:!?])/g, '$1')
    .replace(/,{2,}/g, ',')
    .replace(/([!?]),/g, '$1')
    .replace(/(?<!\.)\.,/g, '.')
    .replace(/,([.!?])/g, '$1')
    .replace(/^[ \t]*[,;:]+[ \t]*/gm, '')
    .replace(/[ \t]{2,}/g, ' ');
}

const NO_CAPITAL_AFTER = /\b(?:e\.g|i\.e|etc|vs|mr|mrs|ms|dr|st|approx|inc|ltd|jr|sr)\.$/i;

export function capitalizeSentences(text) {
  let t = text.replace(/(^|[.!?]["')]?\s+|\n(?:[-*]\s+|\d+\.\s+)?)(\p{Ll})/gu, (m, prefix, ch, offset, whole) => {
    const before = whole.slice(0, offset + prefix.length).trimEnd();
    if (NO_CAPITAL_AFTER.test(before)) return m;
    return prefix + ch.toUpperCase();
  });
  t = t.replace(/\bi\b(?!\.e\.)/g, 'I');
  return capitalizeCalendarWords(t);
}

// Weekdays and unambiguous months are proper nouns; "may", "march" and
// "august" are only capitalised when they clearly refer to a date.
const ALWAYS_CAPITALISED = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|april|june|july|september|october|november|december)\b/g;
const DATE_MONTHS = /\b(in|on|by|of|next|last|this|early|late|mid|until|before|after|since)\s+(may|march|august)\b|\b(may|march|august)(?=\s+\d)/g;

function capitalizeCalendarWords(text) {
  return text
    .replace(ALWAYS_CAPITALISED, (w) => capitalizeFirst(w))
    .replace(DATE_MONTHS, (m) => m.replace(/\b(may|march|august)\b/, (w) => capitalizeFirst(w)));
}

// ---------------------------------------------------------------------------
// Styles (Wispr's Formal. / Casual / very casual / Excited!)
// ---------------------------------------------------------------------------
const endsWithList = (t) => /(?:^|\n)(?:\d+\.|-)\s[^\n]*$/.test(t);

function ensureTerminalPunctuation(t, mark) {
  if (!t || endsWithList(t)) return t;
  if (/[\p{L}\p{N})"']$/u.test(t)) return t + mark;
  return t;
}

function dropFinalPeriod(t) {
  return t.replace(/(?<!\.)\.(["')]?)$/, '$1');
}

function lowercaseSentenceStarts(t) {
  return t.replace(/(^|[.!?]\s+|\n)(\p{Lu})(\p{L}*(?:'\p{L}+)?)/gu, (m, prefix, first, rest) => {
    const word = (first + rest).toLowerCase();
    if (word === 'i' || word.startsWith("i'")) return m;
    return COMMON_WORDS.has(word) ? prefix + first.toLowerCase() + rest : m;
  });
}

export function applyStyle(text, style) {
  let t = text;
  switch (style) {
    case 'casual':
      return dropFinalPeriod(t);
    case 'very_casual':
      t = dropFinalPeriod(t);
      t = lowercaseSentenceStarts(t);
      t = t.replace(/(^|\n)(hey|hi|hello|yo|hiya)\s*,\s*/gi, '$1$2 ');
      t = t.replace(/\b(\d{1,2}(?::\d{2})?) ([AP])M\b/g, (m, time, ap) => `${time}${ap.toLowerCase()}m`);
      return t;
    case 'excited':
      t = t.replace(/(?<!\.)\.(["')]?)$/, '!$1');
      t = t.replace(/^((?:hi|hey|hello)\b[^.!?\n,]{0,30})\.(\s)/i, '$1!$2');
      return ensureTerminalPunctuation(t, '!');
    case 'formal':
    default:
      return ensureTerminalPunctuation(t, '.');
  }
}

// ---------------------------------------------------------------------------
// Email layout: greeting line, body, sign-off block
// ---------------------------------------------------------------------------
// Names must be capitalised, so the greeting words are spelled out in both
// cases instead of using the `i` flag (which would make \p{Lu} match "it").
const GREETING = /^((?:[Hh]i|[Hh]ey|[Hh]ello|[Dd]ear|[Gg]ood (?:[Mm]orning|[Aa]fternoon|[Ee]vening)|[Gg]reetings)(?:[ \t]+\p{Lu}[\p{L}.'-]*){0,3})[ \t]*[,!:.]?\s+(?=\S)/u;
const SIGNOFF_WORDS = '(?:best regards|kind regards|warm regards|regards|best|thanks|thank you|many thanks|cheers|sincerely|all the best|talk soon|take care)';
const SIGNOFF = new RegExp(String.raw`(^|[.!?]\s+|\n+)(${SIGNOFF_WORDS})[,.!]?\s+([\p{L}][\p{L}'-]+(?:\s+[\p{L}][\p{L}'-]+)?)[.!]?\s*$`, 'iu');

export function hasSignoff(text) {
  return new RegExp(String.raw`(?:^|\n|[.!?]\s+)${SIGNOFF_WORDS}[,.!]?(?:\s+\S+){0,2}\s*$`, 'i').test(text.trim());
}

export function formatEmail(text) {
  let t = text.trim();
  let greeting = '';
  const g = t.match(GREETING);
  // Only treat it as a greeting when a real body follows.
  if (g && t.length - g[0].length > 10) {
    greeting = `${capitalizeFirst(g[1].trim())},`;
    t = capitalizeFirst(t.slice(g[0].length));
  }
  let signoff = '';
  const s = t.match(SIGNOFF);
  // Checked without the `i` flag: "Thanks for your help." is not a sign-off.
  if (s && s.index > 0 && /^\p{Lu}/u.test(s[3]) && !COMMON_WORDS.has(s[3].split(/\s+/)[0].toLowerCase())) {
    const name = s[3];
    signoff = `${capitalizeFirst(s[2].toLowerCase())},\n${name}`;
    t = t.slice(0, s.index) + (s[1].trim() ? s[1].trim() : '');
  }
  return [greeting, t.trim(), signoff].filter(Boolean).join('\n\n');
}

// ---------------------------------------------------------------------------
// Full rule pipeline
// ---------------------------------------------------------------------------
export function applyRules(raw, { cleanupLevel = 'light', smartFormatting = true, style = 'formal', category = 'other', english = true } = {}) {
  let t = normalizeWhitespace(raw);
  if (!t) return t;
  // Rules are English-specific; other languages only get whitespace cleanup.
  if (!english) return t;

  if (smartFormatting) t = applySpokenCommands(t);
  t = normalizeTimes(t);
  if (cleanupLevel !== 'none') {
    t = stripFillers(t);
    if (cleanupLevel === 'medium' || cleanupLevel === 'high') t = stripPhraseFillers(t, cleanupLevel);
    t = removeStutters(t);
    t = applyBacktracking(t);
  }
  if (smartFormatting) t = formatLists(t);
  t = tidyPunctuation(t);
  if (cleanupLevel !== 'none') {
    t = capitalizeSentences(t);
    t = applyStyle(t, style);
    if (smartFormatting && category === 'email') t = formatEmail(t);
  }
  return normalizeWhitespace(t);
}
