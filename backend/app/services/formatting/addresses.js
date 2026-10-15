// File: app/services/formatting/addresses.js
// Email addresses, web addresses and domains. Speech recognition hands them
// over spoken ("kapil dot sharma at gmail dot com") or split apart
// ("gmail. Com"); these helpers write them the way they're typed and let the
// sentence rules recognise them, so nothing capitalises or punctuates inside
// an address.

const TLDS = [
  'com', 'org', 'net', 'io', 'co', 'in', 'edu', 'gov', 'ai', 'dev', 'app', 'me', 'us', 'uk', 'ca', 'de', 'fr',
  'au', 'info', 'biz', 'xyz', 'tech', 'so', 'gg', 'tv', 'ly', 'to', 'sh', 'cc', 'site', 'online', 'store', 'blog',
  'cloud', 'page', 'live', 'email', 'ac',
];
const TLD = String.raw`(?:${TLDS.join('|')})(?:\.(?:uk|in|au|jp|nz|za))?`;
// Endings that are never ordinary words, so "gmail. Com" can safely be
// re-joined without gluing real sentences together ("Delhi. In the ...").
const UNAMBIGUOUS_TLD = String.raw`(?:com|org|net|io|edu|gov|xyz|biz)`;

const SEPARATORS = { dot: '.', underscore: '_', dash: '-', hyphen: '-' };
const isSeparator = (word) => Object.hasOwn(SEPARATORS, (word || '').toLowerCase());
const isMailboxPart = (word) => /^[\p{L}\p{N}._%+-]+$/u.test(word || '');

// Words that precede "at" in ordinary speech ("look at google.com", "I'm at
// home dot com") and so never start an email address.
const NOT_A_MAILBOX = new Set([
  'i', "i'm", 'im', 'we', "we're", 'you', "you're", 'he', 'she', 'they', "they're", 'it', "it's", 'me', 'us',
  'them', 'him', 'her', 'is', 'are', 'was', 'were', 'be', 'been', 'am', 'look', 'looking', 'looked', 'arrive',
  'arrived', 'meet', 'stay', 'staying', 'work', 'working', 'home', 'here', 'there', 'that', 'this', 'what', 'best',
  'least', 'once', 'all', 'and', 'or', 'but', 'so', 'the', 'a', 'an',
]);
// "the dot com bubble" is a phrase, not a domain.
const NOT_A_DOMAIN_LABEL = new Set(['the', 'a', 'an', 'this', 'that', 'my', 'your', 'our', 'their', 'his', 'her', 'its', 'and', 'or']);

const EMAIL = String.raw`[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,}`;
const WEB = String.raw`(?:https?:\/\/\S+|www\.\S+|[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.${TLD}(?:\/\S*)?)`;
const EMAIL_TOKEN = new RegExp(`^${EMAIL}$`, 'iu');
const WEB_TOKEN = new RegExp(`^${WEB}$`, 'iu');
const DOMAIN_WORD = new RegExp(String.raw`^([\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.${TLD})([.,;:!?)]*)$`, 'iu');
const TRAILING_PUNCT = /[.,;:!?)"']+$/;

const stripWrapping = (token) => (token || '').replace(/^["'(]+/, '').replace(TRAILING_PUNCT, '');

/** True when a whitespace-free token is an email address, URL or domain. */
export function isAddressToken(token) {
  const t = stripWrapping(token);
  return Boolean(t) && (EMAIL_TOKEN.test(t) || WEB_TOKEN.test(t));
}

/** True when the text is nothing but one or more addresses. */
export function isAddressOnly(text) {
  const parts = (text || '').trim().replace(TRAILING_PUNCT, '').split(/[\s,;]+/).filter(Boolean);
  return parts.length > 0 && parts.every(isAddressToken);
}

/** True when the last word of the text is an address ("...send it to a@b.com"). */
export function endsWithAddress(text) {
  return isAddressToken((text || '').trim().split(/\s+/).pop());
}

// "youtube dot com" -> "youtube.com", "www dot example dot co dot uk" -> "www.example.co.uk"
function joinSpokenDomains(text) {
  const re = new RegExp(String.raw`\b([\p{L}\p{N}-]+)((?:\s+dot\s+[\p{L}\p{N}-]+)*\s+dot\s+${TLD})(?![\p{L}\p{N}])`, 'giu');
  return text.replace(re, (match, first, chain) =>
    NOT_A_DOMAIN_LABEL.has(first.toLowerCase()) ? match : `${first}${chain.replace(/\s+dot\s+/gi, '.')}`,
  );
}

// Joins a spoken mailbox to its domain: "kapil dot sharma at gmail.com" ->
// "kapil.sharma@gmail.com". A word that recognition split off the end of a
// spelled-out mailbox is re-attached ("kapil dot login hta@gmail.com" ->
// "kapil.loginhta@gmail.com"). Whitespace elsewhere is preserved.
function joinSpokenEmails(text) {
  const parts = text.split(/(\s+)/); // words at even indexes, whitespace at odd
  const words = parts.filter((_, i) => i % 2 === 0);
  const removed = new Set();

  for (let i = 0; i < words.length; i++) {
    let mailbox;
    let domainWord;
    let start;
    const glued = words[i].match(/^([\p{L}\p{N}._%+-]*)@(.+)$/u);
    if (glued && DOMAIN_WORD.test(glued[2])) {
      domainWord = glued[2];
      if (glued[1]) {
        mailbox = glued[1];
        start = i;
      } else if (i > 0 && isMailboxPart(words[i - 1])) {
        mailbox = words[i - 1]; // "john @gmail.com"
        start = i - 1;
      } else {
        continue;
      }
    } else if (/^at$/i.test(words[i]) && i > 0 && DOMAIN_WORD.test(words[i + 1] || '')) {
      mailbox = words[i - 1];
      if (!isMailboxPart(mailbox) || NOT_A_MAILBOX.has(mailbox.toLowerCase())) continue;
      domainWord = words[i + 1];
      start = i - 1;
      removed.add(i + 1);
    } else {
      continue;
    }

    let local = mailbox;
    // "... dot login hta@": the word before the mailbox was split off it.
    if (start >= 2 && !isSeparator(words[start - 1]) && /^[\p{L}\p{N}]+$/u.test(words[start - 1]) && isSeparator(words[start - 2])) {
      local = words[start - 1] + local;
      start -= 1;
    }
    // "kapil dot sharma" -> "kapil.sharma"
    while (start >= 2 && isSeparator(words[start - 1]) && isMailboxPart(words[start - 2])) {
      local = words[start - 2] + SEPARATORS[words[start - 1].toLowerCase()] + local;
      start -= 2;
    }

    const [, domain, tail] = domainWord.match(DOMAIN_WORD);
    for (let k = start + 1; k <= i; k++) removed.add(k);
    words[start] = `${local}@${domain}`.toLowerCase() + tail;
  }

  if (!removed.size) return text;
  let out = '';
  words.forEach((word, k) => {
    if (removed.has(k)) return;
    out += (out && k > 0 ? parts[2 * k - 1] : '') + word;
  });
  return out;
}

// Repairs addresses that speech recognition broke apart:
// "gmail. Com" -> "gmail.com", "Www. Youtube.com" -> "Www.Youtube.com".
function repairSplitAddresses(text) {
  let t = text.replace(new RegExp(String.raw`\b([\p{L}\p{N}-]+) ?\. (${UNAMBIGUOUS_TLD})(?![\p{L}\p{N}])`, 'giu'), '$1.$2');
  t = t.replace(/\b(www) ?\. (?=[\p{L}\p{N}-]+\.)/giu, '$1.');
  t = t.replace(new RegExp(String.raw`([\p{L}\p{N}._%+-]) ?@ ?([\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.${TLD})(?![\p{L}\p{N}])`, 'giu'), '$1@$2');
  return t;
}

// Emails are written in lower case; for web addresses only the host is.
function lowercaseAddresses(text) {
  return text.replace(/\S+/g, (word) => {
    const lead = word.match(/^["'(]*/)[0];
    const trail = word.slice(lead.length).match(TRAILING_PUNCT)?.[0] || '';
    const core = word.slice(lead.length, word.length - trail.length);
    if (!core) return word;
    if (EMAIL_TOKEN.test(core)) return lead + core.toLowerCase() + trail;
    if (WEB_TOKEN.test(core)) {
      const m = core.match(/^((?:https?:\/\/)?[^/]+)(.*)$/i);
      return lead + m[1].toLowerCase() + m[2] + trail;
    }
    return word;
  });
}

/** Spoken and split addresses -> written, lower-case addresses. */
export function normalizeAddresses(text) {
  if (!text) return text;
  let t = joinSpokenDomains(text);
  t = repairSplitAddresses(t);
  if (/@|\bat\b/i.test(t)) t = joinSpokenEmails(t);
  return lowercaseAddresses(t);
}

/**
 * For a recipients field (To / Cc) the dictation is only addresses, so every
 * spoken separator and stray space inside each one is joined.
 * "kapil dot login hta at gmail dot com and sam at acme dot io"
 *   -> "kapil.loginhta@gmail.com, sam@acme.io"
 */
export function formatAddressField(text) {
  const spoken = joinSpokenDomains(normalizeSpace(text).replace(/[.!?]+$/, ''));
  return spoken
    .split(/\s*(?:,|;|\band\b)\s*/i)
    .filter(Boolean)
    .map((part) =>
      part
        .split(/\s+/)
        .map((w) => (isSeparator(w) ? SEPARATORS[w.toLowerCase()] : /^at$/i.test(w) ? '@' : w))
        .join('')
        .replace(/\.(?=@)|\.$/g, '')
        .toLowerCase(),
    )
    .join(', ');
}

const normalizeSpace = (text) => (text || '').replace(/\s+/g, ' ').trim();
