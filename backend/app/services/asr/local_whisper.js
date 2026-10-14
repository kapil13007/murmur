// File: app/services/asr/local_whisper.js
// Whisper running inside this Node process via transformers.js (ONNX Runtime).
// No API key needed; the model (~80-250 MB) downloads once into .model-cache.
import path from 'node:path';
import { BACKEND_ROOT, settings } from '../../core/config.js';
import { getLogger } from '../../core/logger.js';

const logger = getLogger('asr.local');

let pipelinePromise = null;
let ready = false;
// Inference is CPU-bound and ONNX Runtime already uses every core, so requests
// are queued instead of running in parallel.
let queue = Promise.resolve();

async function loadPipeline() {
  const started = Date.now();
  const { pipeline, env } = await import('@huggingface/transformers');
  env.cacheDir = path.join(BACKEND_ROOT, '.model-cache');
  logger.info(`Loading ${settings.LOCAL_WHISPER_MODEL} (${settings.LOCAL_WHISPER_DTYPE})...`);
  const asr = await pipeline('automatic-speech-recognition', settings.LOCAL_WHISPER_MODEL, {
    dtype: settings.LOCAL_WHISPER_DTYPE,
  });
  ready = true;
  logger.info(`Local Whisper ready in ${Date.now() - started}ms`);
  return asr;
}

export function warmUpLocalWhisper() {
  if (!pipelinePromise) {
    pipelinePromise = loadPipeline().catch((err) => {
      pipelinePromise = null;
      throw err;
    });
  }
  return pipelinePromise;
}

export function isLocalWhisperReady() {
  return ready;
}

export async function transcribeLocal(samples, { language } = {}) {
  const asr = await warmUpLocalWhisper();
  const options = { task: 'transcribe', chunk_length_s: 30, stride_length_s: 5 };
  if (language) options.language = language;

  const job = queue.then(() => asr(samples, options));
  queue = job.catch(() => {});
  const output = await job;
  const text = Array.isArray(output) ? output.map((o) => o.text).join(' ') : output.text;
  return { text: (text || '').trim(), model: settings.LOCAL_WHISPER_MODEL, detectedLanguage: language || null };
}
