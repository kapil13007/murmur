// File: app/services/asr/remote_whisper.js
// Groq and OpenAI expose the same `/audio/transcriptions` endpoint shape, so
// one client covers both.
import { settings } from '../../core/config.js';
import { requireGroqKey } from '../../core/request_context.js';

const PROVIDERS = {
  groq: {
    url: 'https://api.groq.com/openai/v1/audio/transcriptions',
    key: () => requireGroqKey(),
    model: () => settings.GROQ_ASR_MODEL,
  },
  openai: {
    url: 'https://api.openai.com/v1/audio/transcriptions',
    key: () => settings.OPENAI_API_KEY,
    model: () => settings.OPENAI_ASR_MODEL,
  },
};

export class RemoteAsrError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function transcribeRemote(provider, wav, { language, prompt, timeoutMs = 30_000 } = {}) {
  const cfg = PROVIDERS[provider];
  if (!cfg) throw new RemoteAsrError(`Unknown ASR provider ${provider}`);
  const model = cfg.model();
  // verbose_json also returns the detected language; the gpt-4o-*-transcribe
  // models only support plain json.
  const verbose = provider === 'groq' || model === 'whisper-1';

  const form = new FormData();
  form.append('file', new Blob([wav], { type: 'audio/wav' }), 'dictation.wav');
  form.append('model', model);
  form.append('response_format', verbose ? 'verbose_json' : 'json');
  form.append('temperature', '0');
  if (language) form.append('language', language);
  // Whisper treats the prompt as preceding context, which biases spelling
  // toward the user's vocabulary (names, jargon, product terms).
  if (prompt) form.append('prompt', prompt.slice(0, 800));

  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.key()}` },
    body: form,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new RemoteAsrError(`${provider} transcription failed (${res.status}): ${body.slice(0, 300)}`, res.status);
  }
  const data = await res.json();
  return {
    text: (data.text || '').trim(),
    model,
    detectedLanguage: toIsoLanguage(data.language) || language || null,
  };
}

// verbose_json reports languages by name ("english"); store ISO codes.
const LANGUAGE_NAMES = {
  english: 'en', tamil: 'ta', hindi: 'hi', spanish: 'es', french: 'fr', german: 'de', italian: 'it',
  portuguese: 'pt', dutch: 'nl', russian: 'ru', japanese: 'ja', korean: 'ko', chinese: 'zh', arabic: 'ar',
  telugu: 'te', kannada: 'kn', malayalam: 'ml', marathi: 'mr', bengali: 'bn', gujarati: 'gu', urdu: 'ur',
  turkish: 'tr', polish: 'pl', ukrainian: 'uk', vietnamese: 'vi', indonesian: 'id', swedish: 'sv',
};

function toIsoLanguage(lang) {
  if (!lang) return null;
  const l = String(lang).toLowerCase();
  if (l.length <= 3) return l;
  return LANGUAGE_NAMES[l] || null;
}
