// File: app/services/asr/index.js
// Speech-to-text entry point. Picks the configured provider, falls back to
// local Whisper if a cloud provider errors, and filters the phrases Whisper
// is known to hallucinate on near-silent audio.
import { settings } from '../../core/config.js';
import { HttpError, preconditionRequired } from '../../core/errors.js';
import { getLogger } from '../../core/logger.js';
import { isLocalWhisperReady, transcribeLocal, warmUpLocalWhisper } from './local_whisper.js';
import { transcribeRemote } from './remote_whisper.js';

const logger = getLogger('asr');

// Whole-utterance outputs Whisper produces for silence / background noise.
const HALLUCINATIONS = new Set([
  'you',
  'thank you',
  'thank you.',
  'thanks for watching',
  'thanks for watching!',
  'thank you for watching',
  'thank you for watching!',
  'please subscribe',
  'bye',
  'bye.',
  '[blank_audio]',
  '[music]',
  '(music)',
  '[silence]',
  '(silence)',
  '...',
  '.',
]);

// Bracketed noise tags are always stripped. The phrase list is only applied
// when the recording held very little speech: someone really can dictate
// "Thank you." into a chat.
export function cleanAsrText(text, { weakSpeech = false } = {}) {
  const trimmed = (text || '')
    .replace(/\[(BLANK_AUDIO|MUSIC|NOISE|SILENCE|INAUDIBLE)\]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (weakSpeech && HALLUCINATIONS.has(trimmed.toLowerCase())) return '';
  return /^[\s.,!?-]*$/.test(trimmed) ? '' : trimmed;
}

// Picks a single Whisper language hint from the user's languages; with more
// than one language selected, Whisper auto-detects per dictation.
export function languageHint(selectedLanguages, override) {
  if (override) return override;
  if (Array.isArray(selectedLanguages) && selectedLanguages.length === 1) return selectedLanguages[0];
  return null;
}

// Vocabulary prompt for cloud Whisper, e.g. "Wispr Flow, Kubernetes, Prem."
export function vocabularyPrompt(words) {
  const unique = [...new Set(words.filter(Boolean))].slice(0, 80);
  return unique.length ? `${unique.join(', ')}.` : undefined;
}

export async function transcribe({ samples, wav, language, vocabulary = [], speechSeconds = Infinity }) {
  const started = Date.now();
  const provider = settings.ASR_PROVIDER;
  let result;
  let usedProvider = provider;
  if (provider === 'local') {
    result = await transcribeLocal(samples, { language });
  } else {
    try {
      result = await transcribeRemote(provider, wav, { language, prompt: vocabularyPrompt(vocabulary) });
    } catch (err) {
      if (err instanceof HttpError) throw err; // e.g. no Groq key yet
      // Public servers have no local Whisper and don't hide a bad key: say so.
      if (settings.REQUIRE_USER_KEY) throw remoteFailure(provider, err);
      logger.warn(`${provider} ASR failed, falling back to local Whisper: ${err.message}`);
      usedProvider = 'local';
      result = await transcribeLocal(samples, { language });
    }
  }
  return {
    text: cleanAsrText(result.text, { weakSpeech: speechSeconds < 0.8 }),
    provider: usedProvider,
    model: result.model,
    detectedLanguage: result.detectedLanguage,
    latencyMs: Date.now() - started,
  };
}

export function asrStatus() {
  const provider = settings.ASR_PROVIDER;
  return {
    provider,
    model:
      provider === 'local'
        ? settings.LOCAL_WHISPER_MODEL
        : provider === 'groq'
          ? settings.GROQ_ASR_MODEL
          : settings.OPENAI_ASR_MODEL,
    ready: provider === 'local' ? isLocalWhisperReady() : true,
  };
}

export function warmUpAsr() {
  // Even with a cloud provider configured, local Whisper is the fallback.
  if (settings.ASR_PROVIDER === 'local' && settings.ASR_PRELOAD) {
    warmUpLocalWhisper().catch((err) => logger.error(`Could not load local Whisper: ${err.message}`));
  }
}

// A cloud failure on a public server, in words the user can act on.
function remoteFailure(provider, err) {
  const name = provider === 'groq' ? 'Groq' : provider;
  if (err.status === 401 || err.status === 403) {
    return preconditionRequired(`${name} rejected your API key. Check or replace it in Settings.`, { code: 'groq_key_invalid' });
  }
  if (err.status === 429) {
    return new HttpError(429, `Your ${name} key hit its rate limit. Wait a moment and try again.`, { code: 'groq_rate_limited' });
  }
  logger.warn(`${provider} ASR failed: ${err.message}`);
  return new HttpError(502, `${name} couldn't transcribe that. Try again in a moment.`, { code: 'asr_failed' });
}
