// File: app/core/validators.js
// Request validation glue between Zod schemas (app/schemas) and Express.
import { z } from 'zod';
import { HttpError } from './errors.js';

function formatIssues(error) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || null,
    message: issue.message,
  }));
}

// validate({ body, query, params }) parses each part with its schema and
// replaces the raw value with the parsed (coerced, defaulted) one.
export function validate(schemas) {
  return (req, res, next) => {
    for (const part of ['params', 'query', 'body']) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part] ?? {});
      if (!result.success) {
        const errors = formatIssues(result.error);
        const first = errors[0];
        const detail = first?.field ? `${first.field}: ${first.message}` : first?.message || 'Invalid request';
        return next(new HttpError(422, detail, { extra: { errors } }));
      }
      // Express 5 exposes req.query as a getter, so stash parsed values separately.
      if (part === 'query') req.validatedQuery = result.data;
      else req[part] = result.data;
    }
    return next();
  };
}

export const uuidParam = (name = 'id') => z.object({ [name]: z.uuid({ message: 'Invalid id' }) });

// Shared password policy used by register / change-password.
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'Password must contain at least one letter and one number');

// Query-string booleans arrive as strings ("true"/"false").
export const queryBool = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((v) => v === true || v === 'true' || v === '1');
