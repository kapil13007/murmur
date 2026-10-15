// File: app/services/dictionary_service.js
// Vocabulary + snippets management, bulk import, and learning new words from
// the corrections a user makes to their transcripts.
import { conflict, notFound } from '../core/errors.js';
import {
  createEntry,
  deleteEntries,
  findByPhrase,
  getOwnEntry,
  listEntries,
  updateEntry,
} from '../crud/dictionary_crud.js';
import { DictionaryEntry } from '../models/index.js';
import { toEntryOut } from '../schemas/dictionary_schema.js';
import { COMMON_WORDS, phoneticKey, similarity, squash } from './formatting/text_utils.js';
import { notify } from './notification_service.js';
import { publish } from './realtime_service.js';

const kindLabel = (isSnippet) => (isSnippet ? 'snippet' : 'word');

export async function listForUser(user, query, isSnippet) {
  const rows = await listEntries(user.id, { ...query, isSnippet });
  return { items: rows.map(toEntryOut) };
}

export async function addEntry(user, { phrase, replacement }, isSnippet, source = 'manual') {
  if (await findByPhrase(user.id, phrase, isSnippet)) {
    throw conflict(isSnippet ? 'You already have a snippet with that name' : 'That word is already in your dictionary');
  }
  // "Correct a misspelling" with identical text is just a plain word.
  if (!isSnippet && replacement?.trim() === phrase.trim()) replacement = null;
  const entry = await createEntry({
    user_id: user.id,
    phrase: phrase.trim(),
    replacement: replacement?.trim() ? (isSnippet ? replacement : replacement.trim()) : null,
    is_snippet: isSnippet,
    source,
  });
  publish(user.id, 'dictionary.changed', { is_snippet: isSnippet });
  return toEntryOut(entry);
}

async function loadOwn(user, id, isSnippet) {
  const entry = await getOwnEntry(user.id, id, isSnippet);
  if (!entry) throw notFound(`${isSnippet ? 'Snippet' : 'Word'} not found`);
  return entry;
}

export async function editEntry(user, id, changes, isSnippet) {
  const entry = await loadOwn(user, id, isSnippet);
  if (changes.phrase && changes.phrase.toLowerCase() !== entry.phrase.toLowerCase()) {
    const clash = await findByPhrase(user.id, changes.phrase, isSnippet);
    if (clash && clash.id !== entry.id) throw conflict(`You already have that ${kindLabel(isSnippet)}`);
  }
  const before = JSON.stringify([entry.phrase, entry.replacement, entry.is_starred]);
  await updateEntry(entry, changes);
  if (JSON.stringify([entry.phrase, entry.replacement, entry.is_starred]) === before) {
    return { ...toEntryOut(entry), unchanged: true };
  }
  publish(user.id, 'dictionary.changed', { is_snippet: isSnippet });
  return toEntryOut(entry);
}

export async function removeEntries(user, ids, isSnippet) {
  const deletable = [];
  for (const id of ids) {
    const entry = await getOwnEntry(user.id, id, isSnippet);
    // Silently skip entries that don't exist (or aren't this user's).
    if (entry) deletable.push(entry.id);
  }
  const deleted = deletable.length ? await deleteEntries(deletable) : 0;
  if (deleted) publish(user.id, 'dictionary.changed', { is_snippet: isSnippet });
  return { deleted, failed: ids.length - deleted };
}

// One entry per line. Accepted forms:
//   word
//   misspelling -> Correct Spelling      (vocabulary correction)
//   trigger => expansion text             (snippet)
//   "phrase","replacement"                (CSV export from another tool)
export async function importEntries(user, text, isSnippet) {
  let created = 0;
  let skipped = 0;
  const errors = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  for (const line of lines.slice(0, 2000)) {
    let phrase = line;
    let replacement = null;
    const arrow = line.match(/^(.+?)\s*(?:=>|->|→|\t)\s*(.+)$/);
    const csv = line.match(/^"([^"]+)"\s*,\s*"([^"]*)"$/) || line.match(/^([^,]+),(.+)$/);
    if (arrow) [, phrase, replacement] = arrow;
    else if (csv) [, phrase, replacement] = csv;
    phrase = phrase.trim().slice(0, 255);
    replacement = replacement?.trim() || null;
    if (isSnippet && !replacement) {
      errors.push(`"${line.slice(0, 40)}" has no expansion`);
      skipped++;
      continue;
    }
    if (await findByPhrase(user.id, phrase, isSnippet)) {
      skipped++;
      continue;
    }
    await createEntry({ user_id: user.id, phrase, replacement, is_snippet: isSnippet, source: 'import' });
    created++;
  }
  if (created) publish(user.id, 'dictionary.changed', { is_snippet: isSnippet });
  return { created, skipped, errors: errors.slice(0, 10) };
}

// ---------------------------------------------------------------------------
// Learning from edits (Wispr's "Auto-add to dictionary")
// ---------------------------------------------------------------------------
function wordsOf(text) {
  return [...(text || '').matchAll(/[\p{L}\p{N}][\p{L}\p{N}'’.-]*[\p{L}\p{N}]|[\p{L}\p{N}]/gu)].map((m) => m[0]);
}

// Word-level LCS diff -> list of { removed: [...], added: [...] } hunks.
export function diffWords(beforeText, afterText) {
  const a = wordsOf(beforeText);
  const b = wordsOf(afterText);
  const n = a.length;
  const m = b.length;
  if (n * m > 250_000) return [];
  // Exact comparison: capitalisation fixes ("github" -> "GitHub") are edits too.
  const eq = (x, y) => x === y;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = eq(a[i], b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const hunks = [];
  let i = 0;
  let j = 0;
  let removed = [];
  let added = [];
  const flush = () => {
    if (removed.length || added.length) hunks.push({ removed, added });
    removed = [];
    added = [];
  };
  while (i < n || j < m) {
    if (i < n && j < m && eq(a[i], b[j])) {
      flush();
      i++;
      j++;
    } else if (j < m && (i >= n || dp[i][j + 1] >= dp[i + 1][j])) {
      added.push(b[j++]);
    } else {
      removed.push(a[i++]);
    }
  }
  flush();
  return hunks;
}

function isDistinctiveWord(word, index, words) {
  const lower = word.toLowerCase();
  if (word.length < 2) return false;
  if (/\d/.test(word) && /\p{L}/u.test(word)) return true; // "GPT4", "B2B"
  if (/\p{Ll}\p{Lu}/u.test(word)) return true; // camelCase / "iPhone"
  if (/^\p{Lu}/u.test(word) && index > 0 && !/[.!?]$/.test(words[index - 1] || '')) return true; // proper noun
  return !COMMON_WORDS.has(lower) && word.length >= 4;
}

export function extractLearnableCorrections(beforeText, afterText) {
  const learned = [];
  for (const { removed, added } of diffWords(beforeText, afterText)) {
    // A small swap is a mis-recognised term; a big one is a rewrite.
    if (!removed.length || !added.length || added.length > 3 || removed.length > 4) continue;
    const addedPhrase = added.join(' ');
    const removedPhrase = removed.join(' ');
    if (squash(addedPhrase) === squash(removedPhrase) && addedPhrase.toLowerCase() === removedPhrase.toLowerCase()) {
      // Only capitalisation changed, e.g. "github" -> "GitHub".
      if (added.some((w, i) => isDistinctiveWord(w, i + 1, ['', ...added]))) learned.push({ phrase: addedPhrase, replacement: null });
      continue;
    }
    if (!added.some((w, i) => isDistinctiveWord(w, i + 1, ['', ...added]))) continue;
    const sim = similarity(squash(removedPhrase), squash(addedPhrase));
    const soundsAlike = phoneticKey(squash(removedPhrase)) === phoneticKey(squash(addedPhrase));
    if (sim < 0.3 && !soundsAlike) continue; // a different word, not a mishearing
    // Close variants are caught by fuzzy vocabulary matching; distant ones
    // need an explicit "misspelling -> correction" rule to be fixed next time.
    learned.push(sim >= 0.75 || soundsAlike ? { phrase: addedPhrase, replacement: null } : { phrase: removedPhrase, replacement: addedPhrase });
  }
  return learned.slice(0, 5);
}

export async function learnFromEdit(user, prefs, beforeText, afterText) {
  if (!prefs.auto_add_to_dictionary) return [];
  const candidates = extractLearnableCorrections(beforeText, afterText);
  const added = [];
  for (const c of candidates) {
    const existing = await findByPhrase(user.id, c.phrase, false);
    if (existing) continue;
    const entry = await DictionaryEntry.create({
      user_id: user.id,
      phrase: c.phrase,
      replacement: c.replacement,
      is_snippet: false,
      source: 'auto_learned',
    });
    added.push(entry);
  }
  if (added.length) {
    const names = added.map((e) => `"${e.replacement || e.phrase}"`).join(', ');
    await notify(
      user.id,
      {
        type: 'learning',
        key: `learning:${added.map((e) => e.id).join(',')}`,
        title: `Murmur learned ${added.length} new word${added.length > 1 ? 's' : ''}`,
        body: `Added ${names} to your dictionary so it's spelled right next time.`,
        action_label: 'Open dictionary',
        action_url: '/dictionary',
      },
      { prefs },
    );
    publish(user.id, 'dictionary.changed', { is_snippet: false });
  }
  return added.map(toEntryOut);
}
