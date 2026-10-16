// File: app/core/errors.js
// HttpError is the single way routers/services signal an expected failure.
// Anything else that bubbles up is treated as a bug: logged with a request id
// and answered with a generic 500 so internals never leak to the client.
import crypto from 'node:crypto';
import { getLogger } from './logger.js';

const logger = getLogger('errors');

export class HttpError extends Error {
  constructor(status, detail, { code, extra } = {}) {
    super(detail);
    this.status = status;
    this.detail = detail;
    this.code = code;
    this.extra = extra;
  }
}

export const badRequest = (detail, opts) => new HttpError(400, detail, opts);
export const unauthorized = (detail = 'Could not validate credentials', opts) => new HttpError(401, detail, opts);
export const forbidden = (detail = 'You do not have access to this resource', opts) => new HttpError(403, detail, opts);
export const notFound = (detail = 'Not found', opts) => new HttpError(404, detail, opts);
export const conflict = (detail, opts) => new HttpError(409, detail, opts);
export const preconditionRequired = (detail, opts) => new HttpError(428, detail, opts);
export const unprocessable = (detail, opts) => new HttpError(422, detail, opts);
export const serviceUnavailable = (detail, opts) => new HttpError(503, detail, opts);

export function notFoundHandler(req, res) {
  res.status(404).json({ detail: `Route ${req.method} ${req.originalUrl} not found` });
}

// Express recognises error middleware by its 4-argument signature.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    const body = { detail: err.detail };
    if (err.code) body.code = err.code;
    if (err.extra) Object.assign(body, err.extra);
    return res.status(err.status).json(body);
  }
  // Malformed JSON bodies and oversized uploads come from the framework layer.
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ detail: 'Request body is not valid JSON' });
  }
  if (err?.name === 'MulterError') {
    const detail = err.code === 'LIMIT_FILE_SIZE' ? 'Audio file is too large' : err.message;
    return res.status(413).json({ detail });
  }
  if (err?.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ detail: 'That item already exists' });
  }
  const requestId = crypto.randomUUID();
  logger.error(`Unhandled error [${requestId}] on ${req.method} ${req.originalUrl}`, err);
  return res.status(500).json({ detail: 'An internal error occurred.', request_id: requestId });
}
