// File: app/core/limiter.js
// Rate limiters live in their own module so both main.js and the routers can
// import them without a circular import through main.
import { rateLimit } from 'express-rate-limit';
import { settings } from './config.js';

const make = (windowMs, limit, detail) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    // Tests hammer the auth endpoints; limits are exercised manually instead.
    skip: () => settings.isTest,
    handler: (req, res) => res.status(429).json({ detail }),
  });

export const loginLimiter = make(60_000, 10, 'Too many login attempts. Please wait a minute and try again.');
export const registerLimiter = make(60 * 60_000, 20, 'Too many accounts created from this network. Try again later.');
export const passwordLimiter = make(60_000, 5, 'Too many attempts. Please wait a minute and try again.');
// Dictation is the hot path: generous, but stops a runaway client loop.
export const dictationLimiter = make(60_000, 120, 'You are dictating too fast. Please slow down.');
export const llmLimiter = make(60_000, 60, 'Too many AI requests. Please wait a moment.');
