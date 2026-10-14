// File: app/services/llm/index.js
// Provider-agnostic text completion used by AI formatting, Command Mode and
// Transforms. Callers own the offline fallback when this throws.
import { settings } from '../../core/config.js';
import { completeWithAnthropic } from './anthropic_provider.js';
import { completeWithOpenAICompatible } from './openai_compatible_provider.js';
import { LlmUnavailableError } from './errors.js';

export function isLlmEnabled() {
  return settings.LLM_PROVIDER !== 'none';
}

export function llmStatus() {
  const provider = settings.LLM_PROVIDER;
  const model =
    provider === 'anthropic'
      ? settings.ANTHROPIC_MODEL
      : provider === 'openai'
        ? settings.OPENAI_LLM_MODEL
        : provider === 'groq'
          ? settings.GROQ_LLM_MODEL
          : null;
  return { provider, model, enabled: provider !== 'none' };
}

// effort: "low" for the latency-sensitive dictation cleanup, "medium" for
// Command Mode and Transforms where quality matters more than speed.
export async function complete({ system, user, effort = 'low', maxTokens }) {
  const started = Date.now();
  const provider = settings.LLM_PROVIDER;
  let result;
  if (provider === 'anthropic') {
    result = await completeWithAnthropic({ system, user, effort, maxTokens });
  } else if (provider === 'openai' || provider === 'groq') {
    result = await completeWithOpenAICompatible(provider, { system, user, maxTokens });
  } else {
    throw new LlmUnavailableError('No AI provider is configured', { provider: 'none' });
  }
  return { ...result, latencyMs: Date.now() - started };
}

export { LlmError, LlmRefusalError, LlmUnavailableError } from './errors.js';
