// File: app/services/formatting/text_utils.js
// Small string helpers shared by the formatting rules and dictionary matcher.

export function countWords(text) {
  const m = (text || '').match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu);
  return m ? m.length : 0;
}

export function normalizeWhitespace(text) {
  return (text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Letters/digits only, lower-cased: "Chat GPT," -> "chatgpt".
export const squash = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

export function similarity(a, b) {
  const longest = Math.max(a.length, b.length);
  return longest === 0 ? 1 : 1 - levenshtein(a, b) / longest;
}

// Compact Metaphone-style key: words that sound alike map to the same key
// ("kubernetes" / "cooper netties" -> KBRNTS, "wispr flow" / "wisper flo").
export function phoneticKey(input) {
  let s = input.toLowerCase().replace(/[^a-z]/g, '');
  if (!s) return '';
  s = s
    .replace(/^(kn|gn|pn|wr|ps)/, (m) => m[1])
    .replace(/^x/, 's')
    .replace(/^wh/, 'w')
    .replace(/ph/g, 'f')
    .replace(/ck/g, 'k')
    .replace(/sch/g, 'sk')
    .replace(/tch/g, 'ch')
    .replace(/dg(?=[eiy])/g, 'j')
    .replace(/gh(?![aeiou])/g, '')
    .replace(/c(?=[iey])/g, 's')
    .replace(/(sh|ch)/g, 'x')
    .replace(/th/g, '0')
    .replace(/c/g, 'k')
    .replace(/q/g, 'k')
    .replace(/x/g, 'ks')
    .replace(/g(?=[iey])/g, 'j')
    .replace(/z/g, 's')
    .replace(/v/g, 'f')
    .replace(/w(?![aeiou])/g, '')
    .replace(/y(?![aeiou])/g, '')
    .replace(/([^aeiou])h/g, '$1');
  const first = s[0];
  const rest = s.slice(1).replace(/[aeiouy]/g, '');
  return (first + rest).replace(/(.)\1+/g, '$1').toUpperCase();
}

export function capitalizeFirst(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

// Common English words. Used to (a) keep fuzzy vocabulary matching from
// "correcting" ordinary words, (b) decide which sentence-initial words may be
// lower-cased in the "very casual" style and (c) skip ordinary words when
// learning new vocabulary from edits.
export const COMMON_WORDS = new Set(
  `a about above actually after again against ago ah all almost also although always am an and another any anyone
  anything are around as ask at away awesome back bad be because been before being below best better between big bit
  both brief bring but buy by call came can cannot can't car case cause change check come coming could couldn't course
  day days dear did didn't different do does doesn't doing done don't down during each early easy either else email
  end enough even evening ever every everyone everything example family far feel few file find fine first five for
  found four free friday friend from front full fun get gets getting give glad go goes going gone good got great group
  guess guys had hand happy hard has hasn't have haven't having he he'd he'll he's hear hello help her here hers hey
  hi high him his hold home hope hour hours house how however i i'd i'll i'm i've idea if important in info inside
  instead into is isn't it it's its just keep kind know last late later least leave left less let let's life like
  little long look looking lot love lunch made make making many may maybe me mean meet meeting message might mind
  minute minutes monday month more morning most move much must my myself name need never new next nice night no none
  nope not note nothing now number of off ok okay old on once one only open or order other our out over own page part
  people perfect person phone place plan please point possible pretty probably problem put question quick quite rather
  really reason right room said same saturday say says school see seems send sent set she she'd she'll she's should
  show side since small so some someone something sometimes soon sorry sound sounds start still stop story stuff such
  sunday super sure take talk team tell than thank thanks that that's the their them then there there's these they
  they'd they'll they're they've thing things think this those though thought three through thursday time to today
  together tomorrow tonight too top total try trying tuesday turn two under understand until up update us use used
  very wait want wanted was wasn't watch water way we we'd we'll we're we've wednesday week weekend weeks well went
  were weren't what what's when where whether which while who whole why will with without won't word words work
  working world would wouldn't write wrong yeah year years yes yesterday yet you you'd you'll you're you've your
  yours yup also anyway besides cool done dude everybody exactly great hmm honestly literally lol oh oops seriously
  so sorry thanks totally true unless wow yay`
    .split(/\s+/)
    .filter(Boolean),
);
