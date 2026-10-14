// File: scripts/download_model.js
// Downloads the local Whisper model into backend/.model-cache ahead of time
// (for example while building the Docker image) so the first dictation after
// a deploy doesn't wait for a ~80-250 MB download.
//   node scripts/download_model.js [model-id] [dtype]
// Reads LOCAL_WHISPER_MODEL / LOCAL_WHISPER_DTYPE from .env when present, but
// unlike the server it needs no database or secrets.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env'), quiet: true });

const model = process.argv[2] || process.env.LOCAL_WHISPER_MODEL || 'onnx-community/whisper-base';
const dtype = process.argv[3] || process.env.LOCAL_WHISPER_DTYPE || 'q8';

async function main() {
  const { pipeline, env } = await import('@huggingface/transformers');
  env.cacheDir = path.join(root, '.model-cache');
  console.log(`Fetching ${model} (${dtype}) into ${env.cacheDir} ...`);
  const started = Date.now();
  const asr = await pipeline('automatic-speech-recognition', model, { dtype });
  // Half a second of silence proves the model loads and runs.
  await asr(new Float32Array(8000), { task: 'transcribe', language: 'en' });
  await asr.dispose?.();
  console.log(`Model ready in ${((Date.now() - started) / 1000).toFixed(1)} s.`);
}

main().catch((err) => {
  console.error(`Model download failed: ${err.message}`);
  process.exit(1);
});
