// File: app/services/llm/openai_compatible_provider.js
// OpenAI and Groq chat completions share one request/response shape.
import { settings } from '../../core/config.js';
import { LlmError } from './errors.js';

const PROVIDERS = {
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    key: () => settings.OPENAI_API_KEY,
    model: () => settings.OPENAI_LLM_MODEL,
  },
  groq: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    key: () => settings.GROQ_API_KEY,
    model: () => settings.GROQ_LLM_MODEL,
  },
};

// Reasoning-style OpenAI models only accept the default temperature.
const acceptsTemperature = (provider, model) => provider === 'groq' || /^gpt-4/.test(model);

export async function completeWithOpenAICompatible(provider, { system, user, maxTokens = 4096 }) {
  const cfg = PROVIDERS[provider];
  const model = cfg.model();
  const body = {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    max_completion_tokens: maxTokens,
  };
  if (acceptsTemperature(provider, model)) body.temperature = 0.2;

  let res;
  try {
    res = await fetch(cfg.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.key()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(settings.LLM_TIMEOUT_MS),
    });
  } catch (err) {
    throw new LlmError(`${provider} request failed: ${err.message}`, { provider, retryable: true });
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new LlmError(`${provider} API error ${res.status}: ${detail.slice(0, 300)}`, {
      provider,
      status: res.status,
      retryable: res.status === 429 || res.status >= 500,
    });
  }
  const data = await res.json();
  const choice = data.choices?.[0];
  return {
    text: (choice?.message?.content || '').trim(),
    provider,
    model: data.model || model,
    truncated: choice?.finish_reason === 'length',
  };
}
