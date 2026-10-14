// File: app/services/command_service.js
// Command Mode: hold the command shortcut, speak an instruction, and Flow
// rewrites the selected text (or writes new text at the cursor).
import { HttpError, forbidden, paymentRequired } from '../core/errors.js';
import { createTranscript } from '../crud/transcript_crud.js';
import { createCommandRun } from '../crud/transform_crud.js';
import { getPreferences } from '../crud/preference_crud.js';
import { languageHint, transcribe } from './asr/index.js';
import { hasSpeech } from './audio/wav.js';
import { getSubscriptionSummary } from './billing_service.js';
import { decodeUpload } from './dictation_service.js';
import { applyRules } from './formatting/rules.js';
import { countWords } from './formatting/text_utils.js';
import { runTextInstruction } from './text_instruction_service.js';

export async function runCommand(user, file, meta) {
  const prefs = await getPreferences(user.id);
  if (!prefs.command_mode_enabled) throw forbidden('Command Mode is turned off in Settings > System.');
  const subscription = await getSubscriptionSummary(user.id);
  if (!subscription.is_pro) {
    throw paymentRequired('Command Mode is a Flow Pro feature. Upgrade to use voice commands on your text.', {
      code: 'pro_required',
    });
  }

  let instruction = meta.instruction?.trim() || '';
  let transcriptId = null;
  let audioDuration = 0;
  if (!instruction) {
    const audio = decodeUpload(file);
    audioDuration = audio.analysis.durationSeconds;
    if (!hasSpeech(audio.analysis)) {
      return { status: 'no_audio', output: '', message: "We didn't hear a command. Hold the shortcut and speak." };
    }
    const language = languageHint(prefs.selected_languages, meta.language);
    const asr = await transcribe({
      samples: audio.samples,
      wav: audio.wav,
      language,
      speechSeconds: audio.analysis.speechSeconds,
    });
    instruction = applyRules(asr.text, { cleanupLevel: 'light', style: 'formal', smartFormatting: false });
    if (!instruction) return { status: 'empty', output: '', message: "Flow couldn't make out the command." };
    if (prefs.data_retention !== 'never_store') {
      const transcript = await createTranscript({
        user_id: user.id,
        mode: 'command',
        status: 'success',
        asr_text: asr.text,
        formatted_text: instruction,
        num_words: countWords(instruction),
        duration_seconds: audioDuration,
        app_name: prefs.context_awareness ? meta.app_name : null,
        url: prefs.context_awareness ? meta.url : null,
        asr_provider: asr.provider,
        asr_model: asr.model,
        asr_latency_ms: asr.latencyMs,
        language,
      });
      transcriptId = transcript.id;
    }
  }

  const selectedText = meta.selected_text || '';
  const store = prefs.data_retention !== 'never_store';
  try {
    const result = await runTextInstruction({
      purpose: 'command',
      instruction,
      text: selectedText,
      appName: prefs.context_awareness ? meta.app_name : null,
    });
    if (store) {
      await createCommandRun({
        user_id: user.id,
        transcript_id: transcriptId,
        instruction,
        selected_text: selectedText || null,
        output_text: result.output,
        app_name: meta.app_name,
        status: 'success',
        provider: result.provider,
        model: result.model,
        processing_ms: result.processing_ms,
      });
    }
    return {
      status: 'success',
      instruction,
      output: result.output,
      replaced_selection: Boolean(selectedText.trim()),
      provider: result.provider,
    };
  } catch (err) {
    if (store) {
      await createCommandRun({
        user_id: user.id,
        transcript_id: transcriptId,
        instruction,
        selected_text: selectedText || null,
        app_name: meta.app_name,
        status: err instanceof HttpError && err.status === 503 ? 'unsupported' : 'error',
      });
    }
    throw err;
  }
}
