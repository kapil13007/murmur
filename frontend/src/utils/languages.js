// File: src/utils/languages.js
// Languages Whisper transcribes well. Selecting none means auto-detect.
export const LANGUAGES = [
  ['en', 'English'], ['ta', 'Tamil'], ['hi', 'Hindi'], ['te', 'Telugu'], ['kn', 'Kannada'], ['ml', 'Malayalam'],
  ['mr', 'Marathi'], ['bn', 'Bengali'], ['gu', 'Gujarati'], ['ur', 'Urdu'], ['es', 'Spanish'], ['fr', 'French'],
  ['de', 'German'], ['it', 'Italian'], ['pt', 'Portuguese'], ['nl', 'Dutch'], ['ru', 'Russian'], ['uk', 'Ukrainian'],
  ['pl', 'Polish'], ['tr', 'Turkish'], ['ar', 'Arabic'], ['he', 'Hebrew'], ['ja', 'Japanese'], ['ko', 'Korean'],
  ['zh', 'Chinese'], ['vi', 'Vietnamese'], ['id', 'Indonesian'], ['th', 'Thai'], ['sv', 'Swedish'], ['fi', 'Finnish'],
].map(([code, name]) => ({ code, name }));

export const languageName = (code) => LANGUAGES.find((l) => l.code === code)?.name || code;

export function describeLanguages(codes = []) {
  if (!codes.length) return 'Auto-detect (99 languages)';
  const names = codes.map(languageName);
  return names.length <= 2 ? names.join(', ') : `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
}
