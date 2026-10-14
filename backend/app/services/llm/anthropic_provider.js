// File: app/services/llm/anthropic_provider.js
// Claude via the official Anthropic SDK.
import Anthropic from '@anthropic-ai/sdk';
import { settings } from '../../core/config.js';
import { LlmError, LlmRefusalError } from './errors.js';

let client = null;
function getClient() {
  if (!client) {
    client = new Anthropic({
      apiKey: settings.ANTHROPIC_API_KEY,
      timeout: settings.LLM_TIMEOUT_MS,
      // One quick retry: dictation is interactive and the caller has an offline
      // fallback, so waiting through several retries is worse than degrading.
      maxRetries: 1,
    });
  }
  return client;
}

// Models that accept server-side refusal fallback (`fallbacks: "default"`).
const SERVER_FALLBACK_MODELS = new Set(['claude-fable-5-1', 'claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5']);

// `output_config.effort` is accepted on Opus 4.5+, Sonnet 4.6+, Haiku 5.5 and
// the Fable / Mythos models; older models reject it.
function supportsEffort(model) {
  return /^claude-(fable|mythos|opus-(4-[5-9]|5)|sonnet-(4-6|5)|haiku-5)/.test(model);
}

export async function completeWithAnthropic({ system, user, effort = 'low', maxTokens = 16000 }) {
  const model = settings.ANTHROPIC_MODEL;
  const params = {
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
  };
  if (effort && supportsEffort(model)) params.output_config = { effort };

  let response;
  try {
    response = SERVER_FALLBACK_MODELS.has(model)
      ? await getClient().beta.messages.create({
          ...params,
          // If a safety classifier declines, the API re-runs the request on
          // Anthropic's recommended fallback model inside the same call.
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
        })
      : await getClient().messages.create(params);
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      throw new LlmError('Anthropic API key was rejected', { provider: 'anthropic', status: 401 });
    } else if (err instanceof Anthropic.RateLimitError) {
      throw new LlmError('Anthropic rate limit reached', { provider: 'anthropic', status: 429, retryable: true });
    } else if (err instanceof Anthropic.APIConnectionTimeoutError) {
      throw new LlmError('Anthropic request timed out', { provider: 'anthropic', retryable: true });
    } else if (err instanceof Anthropic.APIError) {
      throw new LlmError(`Anthropic API error ${err.status ?? ''}: ${err.message}`, {
        provider: 'anthropic',
        status: err.status,
        retryable: !err.status || err.status >= 500,
      });
    }
    throw err;
  }

  if (response.stop_reason === 'refusal') {
    throw new LlmRefusalError('Claude declined this request', { provider: 'anthropic' });
  }
  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();
  return { text, provider: 'anthropic', model: response.model, truncated: response.stop_reason === 'max_tokens' };
}
