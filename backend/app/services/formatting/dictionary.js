// File: app/services/formatting/dictionary.js
// Applies the user's dictionary to formatted text:
//   1. corrections  "wisper flow" -> "Wispr Flow"  (entries with a replacement)
//   2. vocabulary   fuzzy/phonetic match to the exact spelling of known words
//   3. snippets     "my calendar link" -> "https://cal.com/..."
// Each step reports which entries fired so usage counters can be updated.
import { COMMON_WORDS, escapeRegExp, phoneticKey, similarity, squash } from './text_utils.js';

const WORD_SEPARATOR = String.raw`[\s\-]+`;

function phrasePattern(phrase, separator = WORD_SEPARATOR) {
  const words = phrase.trim().split(/\s+/).map(escapeRegExp);
  return words.join(separator);
}

export function applyCorrections(text, corrections) {
  let out = text;
  let count = 0;
  const used = new Set();
  const sorted = [...corrections].sort((a, b) => b.phrase.length - a.phrase.length);
  for (const entry of sorted) {
    if (!entry.replacement) continue;
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${phrasePattern(entry.phrase)}(?![\\p{L}\\p{N}])`, 'giu');
    out = out.replace(re, (match) => {
      if (match === entry.replacement) return match;
      count++;
      used.add(entry.id);
      return entry.replacement;
    });
  }
  return { text: out, count, used };
}

function tokenize(text) {
  return [...text.matchAll(/[\p{L}\p{N}][\p{L}\p{N}'’]*/gu)].map((m) => {
    // Keep possessives out of the comparison: "Kapil's" matches "Kapil".
    const possessive = m[0].match(/['’]s$/i);
    const word = possessive ? m[0].slice(0, -2) : m[0];
    return { word, start: m.index, end: m.index + word.length };
  });
}

function isMatch(candidate, term, nTokens) {
  const candNorm = squash(candidate);
  if (!candNorm) return false;
  if (candNorm === term.norm) return true;
  if (term.norm.length < 5 || Math.abs(candNorm.length - term.norm.length) > 3) return false;
  // Never "correct" an ordinary lower-case word into a vocabulary term.
  if (nTokens === 1 && COMMON_WORDS.has(candidate.toLowerCase()) && candidate[0] === candidate[0].toLowerCase()) {
    return false;
  }
  const sim = similarity(candNorm, term.norm);
  const samePhonetics = term.key.length >= 3 && phoneticKey(candNorm) === term.key;
  if (samePhonetics && sim >= 0.6) return true;
  const threshold = term.norm.length >= 8 ? 0.84 : 0.8;
  return sim >= threshold && candNorm[0] === term.norm[0];
}

export function applyVocabulary(text, vocabulary) {
  const tokens = tokenize(text);
  const terms = vocabulary
    .filter((v) => !v.replacement && v.phrase && squash(v.phrase).length >= 2)
    .map((v) => ({
      ...v,
      norm: squash(v.phrase),
      key: phoneticKey(squash(v.phrase)),
      nWords: v.phrase.trim().split(/\s+/).length,
    }))
    .sort((a, b) => b.norm.length - a.norm.length);

  const claimed = new Array(tokens.length).fill(false);
  const edits = [];
  const used = new Set();

  for (const term of terms) {
    for (let n = Math.min(4, term.nWords + 1); n >= Math.max(1, term.nWords - 1); n--) {
      for (let i = 0; i + n <= tokens.length; i++) {
        let free = true;
        for (let k = i; k < i + n; k++) if (claimed[k]) free = false;
        if (!free) continue;
        const start = tokens[i].start;
        const end = tokens[i + n - 1].end;
        const span = text.slice(start, end);
        if (n > 1 && /[.!?,;:\n]/.test(span)) continue;
        if (!isMatch(span, term, n)) continue;
        for (let k = i; k < i + n; k++) claimed[k] = true;
        used.add(term.id);
        if (span !== term.phrase) edits.push({ start, end, text: term.phrase });
      }
    }
  }

  let out = text;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  }
  return { text: out, count: edits.length, used };
}

export function expandSnippets(text, snippets) {
  let out = text;
  let count = 0;
  const used = new Set();
  const separator = String.raw`[\s,.;:!?'"\-]+`;
  const sorted = [...snippets].sort((a, b) => b.phrase.length - a.phrase.length);

  // A dictation that is nothing but the trigger becomes exactly the expansion.
  const bare = out.replace(/^[\s"'.,!?]+|[\s"'.,!?]+$/g, '');
  for (const snippet of sorted) {
    if (new RegExp(`^${phrasePattern(snippet.phrase, separator)}$`, 'iu').test(bare)) {
      return { text: snippet.replacement, count: 1, used: new Set([snippet.id]) };
    }
  }

  for (const snippet of sorted) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${phrasePattern(snippet.phrase, separator)}(?![\\p{L}\\p{N}])(\\.(?=\\s*$))?`, 'giu');
    out = out.replace(re, (match, trailingDot) => {
      count++;
      used.add(snippet.id);
      // Don't glue a sentence period onto a pasted URL / email address.
      const endsWithLink = /(https?:\/\/\S+|\S+@\S+\.\S+)$/.test(snippet.replacement);
      return snippet.replacement + (trailingDot && !endsWithLink ? '.' : '');
    });
  }
  return { text: out, count, used };
}
