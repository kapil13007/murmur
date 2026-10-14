// File: app/services/llm/errors.js
export class LlmError extends Error {
  constructor(message, { provider, status, retryable = false } = {}) {
    super(message);
    this.provider = provider;
    this.status = status;
    this.retryable = retryable;
  }
}

// The model declined the request (Claude's `stop_reason: "refusal"`).
export class LlmRefusalError extends LlmError {}

export class LlmUnavailableError extends LlmError {}
