// File: app/services/dictation_service.js
// The dictation pipeline behind the push-to-talk hotkey:
//   audio -> silence check -> speech-to-text -> AI cleanup -> dictionary/
//   snippets -> save (respecting privacy settings) -> usage rollups -> live
//   update to open hub windows.
import { HttpError, badRequest } from '../core/errors.js';
import { localDate } from '../core/dates.js';
import { getLogger } from '../core/logger.js';
import { getAudio, createTranscript, saveAudio, updateTranscript } from '../crud/transcript_crud.js';
import { getFormattingEntries, recordUsage } from '../crud/dictionary_crud.js';
import { getDeviceByUid } from '../crud/device_crud.js';
import { getPreferences } from '../crud/preference_crud.js';
import { listStyles } from '../crud/style_crud.js';
import { getTotals, incrementAppUsage, incrementDailyActivity } from '../crud/activity_crud.js';
import { Transcript } from '../models/index.js';
import { toTranscriptOut } from '../schemas/history_schema.js';
import { AudioFormatError, hasSpeech, prepareAudio } from './audio/wav.js';
import { languageHint, transcribe } from './asr/index.js';
import { categorizeApp, classifyField } from './app_category_service.js';
import { formatTranscript } from './formatting/index.js';
import { countWords } from './formatting/text_utils.js';
import { checkMilestones } from './notification_service.js';
import { publish } from './realtime_service.js';
import { getSummary } from './stats_service.js';

const logger = getLogger('dictation');

export function decodeUpload(file) {
  if (!file?.buffer?.length) throw badRequest('No audio was uploaded');
  try {
    return prepareAudio(file.buffer);
  } catch (err) {
    if (err instanceof AudioFormatError) throw new HttpError(415, err.message);
    throw err;
  }
}

export async function buildFormattingContext(user, prefs, { appName, url, windowTitle, fieldName, language }) {
  const [styles, entries] = await Promise.all([listStyles(user.id), getFormattingEntries(user.id)]);
  // With "Context awareness" off, the app the user is in is ignored entirely.
  const context = prefs.context_awareness ? { appName, url, windowTitle, fieldName } : {};
  const category = categorizeApp(context, styles);
  return {
    category,
    // What kind of text box the cursor is in: an address field (To / Cc),
    // a short one-line field (subject, search, URL bar) or ordinary text.
    field: classifyField(context.fieldName),
    style: styles.find((s) => s.category === category)?.style || 'formal',
    cleanupLevel: prefs.auto_cleanup_level,
    aiFormatting: prefs.ai_formatting,
    smartFormatting: prefs.smart_formatting,
    appName: context.appName || null,
    language,
    firstName: user.first_name,
    lastName: user.last_name,
    emailAutoSignature: prefs.email_auto_signature,
    emailSignature: prefs.email_signature,
    ...entries,
  };
}

// Words Whisper should expect: the user's own name first (it's the word
// most often misheard), then their dictionary.
const vocabularyHints = (ctx) => [
  ctx.firstName,
  ctx.lastName,
  ...ctx.vocabulary.map((v) => v.phrase),
  ...ctx.corrections.map((c) => c.replacement),
];

// Saves the transcript according to the user's data-retention choice. With
// "Never store data" nothing is written and an unsaved instance is returned.
async function persist(prefs, data, audio) {
  if (prefs.data_retention === 'never_store') {
    const ephemeral = Transcript.build(data);
    ephemeral.created_at = new Date();
    ephemeral.setDataValue('has_audio', false);
    return ephemeral;
  }
  const transcript = await createTranscript(data);
  const keepAudio = audio && !prefs.privacy_mode;
  if (keepAudio) await saveAudio(transcript.id, audio.wav, audio.sampleRate);
  transcript.setDataValue('has_audio', Boolean(keepAudio));
  return transcript;
}

async function afterDictation(user, prefs, { words, duration, appName, category }) {
  const today = localDate(prefs.timezone);
  await incrementDailyActivity(user.id, today, { words, duration });
  if (appName) await incrementAppUsage(user.id, appName.slice(0, 255), category, words);

  // Notifications are best-effort and must never slow down or fail a paste.
  (async () => {
    const totals = await getTotals(user.id);
    const summary = await getSummary(user.id, prefs.timezone);
    await checkMilestones(user.id, prefs, {
      wordsBefore: totals.words - words,
      wordsAfter: totals.words,
      dayStreak: summary.day_streak,
    });
  })().catch((err) => logger.warn(`Post-dictation notifications failed: ${err.message}`));
}

export async function processDictation(user, file, meta) {
  const started = Date.now();
  const prefs = await getPreferences(user.id);
  const audio = decodeUpload(file);
  const device = await getDeviceByUid(user.id, meta.device_uid);
  const language = languageHint(prefs.selected_languages, meta.language);
  const ctx = await buildFormattingContext(user, prefs, {
    appName: meta.app_name,
    url: meta.url,
    windowTitle: meta.window_title,
    fieldName: meta.field_name,
    language,
  });

  const base = {
    user_id: user.id,
    device_id: device ? device.id : null,
    mode: meta.mode,
    app_name: prefs.context_awareness ? meta.app_name : null,
    app_category: ctx.category,
    url: prefs.context_awareness ? meta.url : null,
    window_title: prefs.context_awareness ? meta.window_title : null,
    language,
    duration_seconds: audio.analysis.durationSeconds,
    speech_duration_seconds: audio.analysis.speechSpanSeconds,
    mic_device: meta.mic_device,
    timezone_offset_minutes: meta.timezone_offset_minutes,
    app_version: meta.app_version,
    platform: meta.platform,
    personalization: {
      category: ctx.category,
      field: ctx.field,
      style: ctx.style,
      cleanup_level: ctx.cleanupLevel,
      ai_formatting: ctx.aiFormatting,
      smart_formatting: ctx.smartFormatting,
    },
  };

  if (!hasSpeech(audio.analysis)) {
    const transcript = await persist(prefs, { ...base, status: 'no_audio' }, null);
    return { status: 'no_audio', text: '', message: "We didn't hear anything. Check your microphone.", transcript: toTranscriptOut(transcript) };
  }

  const asr = await transcribe({
    samples: audio.samples,
    wav: audio.wav,
    language,
    allowedLanguages: prefs.selected_languages,
    vocabulary: vocabularyHints(ctx),
    speechSeconds: audio.analysis.speechSeconds,
  });
  if (!asr.text) {
    const transcript = await persist(prefs, { ...base, status: 'empty', asr_provider: asr.provider, asr_model: asr.model, asr_latency_ms: asr.latencyMs }, audio);
    return { status: 'empty', text: '', message: "Murmur couldn't make out any words. Try again a little closer to the mic.", transcript: toTranscriptOut(transcript) };
  }

  const formatted = await formatTranscript(asr.text, ctx);
  const words = countWords(formatted.text);
  const transcript = await persist(
    prefs,
    {
      ...base,
      status: 'success',
      asr_text: asr.text,
      formatted_text: formatted.text,
      num_words: words,
      detected_language: asr.detectedLanguage,
      asr_provider: asr.provider,
      asr_model: asr.model,
      formatter: formatted.formatter,
      llm_model: formatted.model,
      asr_latency_ms: asr.latencyMs,
      format_latency_ms: formatted.latencyMs,
      e2e_latency_ms: Date.now() - started,
      num_dictionary_replacements: formatted.dictionaryReplacements,
      num_snippets_expanded: formatted.snippetsExpanded,
    },
    audio,
  );

  await recordUsage([...formatted.usedEntryIds]);
  await afterDictation(user, prefs, {
    words,
    duration: audio.analysis.speechSpanSeconds || audio.analysis.durationSeconds,
    appName: base.app_name,
    category: ctx.category,
  });

  const out = toTranscriptOut(transcript);
  if (prefs.data_retention !== 'never_store') publish(user.id, 'transcript.created', out);
  return {
    status: 'success',
    text: formatted.text,
    transcript: out,
    timings: { asr_ms: asr.latencyMs, format_ms: formatted.latencyMs, total_ms: Date.now() - started },
  };
}

// "Retry transcript": re-run speech-to-text + formatting on the stored audio
// with the user's current dictionary and style settings.
export async function retryTranscript(user, transcript) {
  const stored = await getAudio(transcript.id);
  if (!stored) {
    throw new HttpError(410, 'Cannot retry transcription as audio is no longer available (older than 14 days)', {
      code: 'audio_unavailable',
    });
  }
  const prefs = await getPreferences(user.id);
  const audio = prepareAudio(Buffer.from(stored.data));
  const ctx = await buildFormattingContext(user, prefs, {
    appName: transcript.app_name,
    url: transcript.url,
    windowTitle: transcript.window_title,
    language: transcript.language,
  });
  // The field type isn't re-detectable later, so reuse what was recorded.
  if (transcript.personalization?.field) ctx.field = transcript.personalization.field;
  const asr = await transcribe({
    samples: audio.samples,
    wav: audio.wav,
    language: transcript.language,
    allowedLanguages: prefs.selected_languages,
    vocabulary: vocabularyHints(ctx),
    speechSeconds: audio.analysis.speechSeconds,
  });
  const wasCounted = transcript.status === 'success';
  if (!asr.text) {
    await updateTranscript(transcript, { status: 'empty', asr_text: null, formatted_text: null, edited_text: null });
    return toTranscriptOut(transcript);
  }
  const formatted = await formatTranscript(asr.text, ctx);
  const words = countWords(formatted.text);
  await updateTranscript(transcript, {
    status: 'success',
    asr_text: asr.text,
    formatted_text: formatted.text,
    edited_text: null,
    has_reverted_ai: false,
    num_words: words,
    asr_provider: asr.provider,
    asr_model: asr.model,
    formatter: formatted.formatter,
    llm_model: formatted.model,
    asr_latency_ms: asr.latencyMs,
    format_latency_ms: formatted.latencyMs,
    num_dictionary_replacements: formatted.dictionaryReplacements,
    num_snippets_expanded: formatted.snippetsExpanded,
    error_message: null,
  });
  if (!wasCounted) {
    await afterDictation(user, prefs, {
      words,
      duration: audio.analysis.speechSpanSeconds,
      appName: transcript.app_name,
      category: ctx.category,
    });
  }
  const out = toTranscriptOut(transcript);
  publish(user.id, 'transcript.updated', out);
  return out;
}

// Runs typed text through the same cleanup pipeline (hub "try it" box and
// Style previews) without touching history or usage.
export async function formatText(user, { text, app_name, url, window_title, field_name, style, cleanup_level }) {
  const prefs = await getPreferences(user.id);
  const ctx = await buildFormattingContext(user, prefs, {
    appName: app_name,
    url,
    windowTitle: window_title,
    fieldName: field_name,
    language: languageHint(prefs.selected_languages),
  });
  if (style) ctx.style = style;
  if (cleanup_level) ctx.cleanupLevel = cleanup_level;
  const result = await formatTranscript(text, ctx);
  return {
    text: result.text,
    formatter: result.formatter,
    model: result.model,
    category: ctx.category,
    style: ctx.style,
    dictionary_replacements: result.dictionaryReplacements,
    snippets_expanded: result.snippetsExpanded,
  };
}
