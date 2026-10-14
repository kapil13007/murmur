// File: app/core/config.js
// Loads and validates every environment variable the API depends on, so a
// misconfigured deployment fails at boot instead of on the first request.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const here = path.dirname(fileURLToPath(import.meta.url));
export const BACKEND_ROOT = path.resolve(here, '..', '..');

dotenv.config({ path: path.join(BACKEND_ROOT, '.env'), quiet: true });

const bool = (fallback) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? fallback : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())));

const int = (fallback) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? fallback : Number.parseInt(v, 10)))
    .pipe(z.number().int());

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: int(8000),
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://127.0.0.1:5173'),
  SERVE_FRONTEND: bool(true),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is not set. Add it to backend/.env'),
  DATABASE_ADMIN_URL: z.string().optional(),

  SECRET_KEY: z.string().min(16, 'SECRET_KEY must be at least 16 characters (see .env.example)'),
  ACCESS_TOKEN_EXPIRE_MINUTES: int(60),
  REMEMBER_ME_EXPIRE_DAYS: int(30),

  ASR_PROVIDER: z.enum(['local', 'groq', 'openai']).default('local'),
  LOCAL_WHISPER_MODEL: z.string().default('onnx-community/whisper-base'),
  LOCAL_WHISPER_DTYPE: z.string().default('q8'),
  ASR_PRELOAD: bool(true),
  GROQ_ASR_MODEL: z.string().default('whisper-large-v3-turbo'),
  OPENAI_ASR_MODEL: z.string().default('whisper-1'),

  LLM_PROVIDER: z.enum(['none', 'anthropic', 'openai', 'groq']).default('none'),
  ANTHROPIC_MODEL: z.string().default('claude-opus-5-5'),
  OPENAI_LLM_MODEL: z.string().default('gpt-4.1-mini'),
  GROQ_LLM_MODEL: z.string().default('llama-3.3-70b-versatile'),
  LLM_TIMEOUT_MS: int(12000),

  GROQ_API_KEY: z.string().optional().default(''),
  OPENAI_API_KEY: z.string().optional().default(''),
  ANTHROPIC_API_KEY: z.string().optional().default(''),

  BASIC_WEEKLY_WORD_LIMIT: int(2000),
  PRO_TRIAL_DAYS: int(14),
  AUDIO_RETENTION_DAYS: int(14),
});

function loadSettings() {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid backend configuration:\n${lines.join('\n')}`);
  }
  const env = parsed.data;

  // A provider that needs a key but has none silently degrades to the
  // offline option, so the app keeps working while the problem is logged.
  const keyFor = { groq: env.GROQ_API_KEY, openai: env.OPENAI_API_KEY, anthropic: env.ANTHROPIC_API_KEY };
  const warnings = [];
  let asrProvider = env.ASR_PROVIDER;
  if (asrProvider !== 'local' && !keyFor[asrProvider]) {
    warnings.push(`ASR_PROVIDER=${asrProvider} but no API key is set; falling back to local Whisper.`);
    asrProvider = 'local';
  }
  let llmProvider = env.LLM_PROVIDER;
  if (llmProvider !== 'none' && !keyFor[llmProvider]) {
    warnings.push(`LLM_PROVIDER=${llmProvider} but no API key is set; falling back to rule-based formatting.`);
    llmProvider = 'none';
  }

  return Object.freeze({
    ...env,
    ASR_PROVIDER: asrProvider,
    LLM_PROVIDER: llmProvider,
    corsOrigins: env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
    isProduction: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
    warnings,
  });
}

export const settings = loadSettings();
