// File: app/services/asr/languages.js
// Whisper's language list (name -> ISO code), used to read the language a
// cloud transcription reports ("icelandic" -> "is") and to decide whether it
// is one of the languages the user actually speaks.
const WHISPER_LANGUAGES = {
  en: 'english', zh: 'chinese', de: 'german', es: 'spanish', ru: 'russian', ko: 'korean', fr: 'french', ja: 'japanese',
  pt: 'portuguese', tr: 'turkish', pl: 'polish', ca: 'catalan', nl: 'dutch', ar: 'arabic', sv: 'swedish', it: 'italian',
  id: 'indonesian', hi: 'hindi', fi: 'finnish', vi: 'vietnamese', he: 'hebrew', uk: 'ukrainian', el: 'greek', ms: 'malay',
  cs: 'czech', ro: 'romanian', da: 'danish', hu: 'hungarian', ta: 'tamil', no: 'norwegian', th: 'thai', ur: 'urdu',
  hr: 'croatian', bg: 'bulgarian', lt: 'lithuanian', la: 'latin', mi: 'maori', ml: 'malayalam', cy: 'welsh', sk: 'slovak',
  te: 'telugu', fa: 'persian', lv: 'latvian', bn: 'bengali', sr: 'serbian', az: 'azerbaijani', sl: 'slovenian', kn: 'kannada',
  et: 'estonian', mk: 'macedonian', br: 'breton', eu: 'basque', is: 'icelandic', hy: 'armenian', ne: 'nepali', mn: 'mongolian',
  bs: 'bosnian', kk: 'kazakh', sq: 'albanian', sw: 'swahili', gl: 'galician', mr: 'marathi', pa: 'punjabi', si: 'sinhala',
  km: 'khmer', sn: 'shona', yo: 'yoruba', so: 'somali', af: 'afrikaans', oc: 'occitan', ka: 'georgian', be: 'belarusian',
  tg: 'tajik', sd: 'sindhi', gu: 'gujarati', am: 'amharic', yi: 'yiddish', lo: 'lao', uz: 'uzbek', fo: 'faroese',
  ht: 'haitian creole', ps: 'pashto', tk: 'turkmen', nn: 'nynorsk', mt: 'maltese', sa: 'sanskrit', lb: 'luxembourgish',
  my: 'myanmar', bo: 'tibetan', tl: 'tagalog', mg: 'malagasy', as: 'assamese', tt: 'tatar', haw: 'hawaiian', ln: 'lingala',
  ha: 'hausa', ba: 'bashkir', jw: 'javanese', su: 'sundanese',
};

const CODE_BY_NAME = Object.fromEntries(Object.entries(WHISPER_LANGUAGES).map(([code, name]) => [name, code]));

// "english" / "en" -> "en"; a name this list doesn't know is kept as typed, so
// it still counts as "not one of the user's languages".
export function toIsoLanguage(lang) {
  if (!lang) return null;
  const l = String(lang).trim().toLowerCase();
  if (WHISPER_LANGUAGES[l]) return l;
  return CODE_BY_NAME[l] || l;
}

// True when Whisper was left to guess among several languages and guessed one
// the user didn't pick, e.g. Icelandic for a short English name.
export function needsLanguageRetry({ language, allowedLanguages, detectedLanguage }) {
  if (language || !detectedLanguage) return false;
  if (!Array.isArray(allowedLanguages) || allowedLanguages.length < 2) return false;
  return !allowedLanguages.includes(toIsoLanguage(detectedLanguage));
}
